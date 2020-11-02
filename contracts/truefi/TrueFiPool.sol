// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {IUniswapRouter} from "./interface/IUniswapRouter.sol";
import {ICurveGauge, ICurveMinter, ICurvePool} from "./interface/ICurve.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {ERC20} from "./upgradeability/UpgradeableERC20.sol";
import {Ownable} from "./upgradeability/UpgradeableOwnable.sol";

/**
 * @title TrueFi Pool
 * @dev Lending pool which uses curve.fi to store idle funds
 * Earn high interest rates on currency deposits through uncollateralized loans
 *
 * Funds deposited in this pool are NOT LIQUID!
 * Exiting the pool will withdraw a basket of LoanTokens backing the pool
 * After exiting, an account will need to wait for LoanTokens to expire and burn them
 * It is recommended to perform a zap or swap tokens on Uniswap for liquidity
 *
 * Funds are managed through an external function to save gas on deposits
 */
contract TrueFiPool is ITrueFiPool, ERC20, ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    ICurvePool public _curvePool;
    ICurveGauge public _curveGauge;
    IERC20 public _currencyToken;
    ITrueLender public _lender;
    ICurveMinter public _minter;
    IUniswapRouter public _uniRouter;

    uint256 public ownerFee = 25;
    uint256 public claimableFees;

    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    event FeeChanged(uint256 newFee);
    event Joined(address indexed staker, uint256 deposited, uint256 minted);
    event Exited(address indexed staker, uint256 amount);
    event Flushed(uint256 currencyAmount);
    event Pulled(uint256 crvAmount);
    event Borrow(uint256 amount);
    event Repaid(address indexed payer, uint256 amount);
    event Collected(address indexed beneficiary, uint256 amount);

    /**
     * @dev Initialize pool
     * @param __curvePool curve pool address
     * @param __curveGauge curve gauge address
     * @param __currencyToken curve pool underlying token
     * @param __lender TrueLender address
     */
    function initialize(
        ICurvePool __curvePool,
        ICurveGauge __curveGauge,
        IERC20 __currencyToken,
        ITrueLender __lender,
        IUniswapRouter __uniRouter
    ) public initializer {
        ERC20.__ERC20_initialize("CurveTUSDPool", "crvTUSD");
        Ownable.initialize();

        _curvePool = __curvePool;
        _curveGauge = __curveGauge;
        _currencyToken = __currencyToken;
        _lender = __lender;
        _minter = _curveGauge.minter();
        _uniRouter = __uniRouter;

        _currencyToken.approve(address(_curvePool), uint256(-1));
        _curvePool.token().approve(address(_curvePool), uint256(-1));
    }

    /**
     * @dev get currency token address
     * @return currency token address
     */
    function currencyToken() public override view returns (IERC20) {
        return _currencyToken;
    }

    /**
     * @dev Get total balance of curve.fi pool tokens
     */
    function totalLiquidityTokenBalance() public view returns (uint256) {
        return _curvePool.token().balanceOf(address(this)).add(_curveGauge.balanceOf(address(this)));
    }

    /**
     * @dev Calculate pool value in USD
     * @return pool value in USD
     */
    function poolValue() public view returns (uint256) {
        return
            currencyBalance().add(_lender.value()).add(
                totalLiquidityTokenBalance().mul(_curvePool.curve().get_virtual_price()).div(1 ether)
            );
    }

    /**
     * @dev ensure enough curve.fi pool tokens are available
     * @param neededAmount amount required
     */
    function ensureEnoughTokensAreAvailable(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = _curvePool.token().balanceOf(address(this));
        if (currentlyAvailableAmount < neededAmount) {
            _curveGauge.withdraw(neededAmount.sub(currentlyAvailableAmount));
        }
    }

    /**
     * @dev set pool fee
     * @param fee pool fee
     */
    function setFee(uint256 fee) external onlyOwner {
        ownerFee = fee;
        emit FeeChanged(fee);
    }

    /**
     * @dev Join the pool by depositing currency tokens
     * @param amount amount of currency token to deposit
     */
    function join(uint256 amount) external override {
        uint256 fee = amount.mul(ownerFee).div(10000);
        uint256 amountToDeposit = amount.sub(fee);

        uint256 amountToMint = amountToDeposit;
        if (totalSupply() > 0) {
            amountToMint = totalSupply().mul(amountToDeposit).div(poolValue());
        }
        _mint(msg.sender, amountToMint);
        claimableFees = claimableFees.add(fee);

        require(_currencyToken.transferFrom(msg.sender, address(this), amount));

        emit Joined(msg.sender, amount, amountToMint);
    }

    /**
     * @dev Exit pool
     * This function will withdraw a basket of currencies backing the pool value
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function exit(uint256 amount) external override nonReentrant {
        require(amount <= balanceOf(msg.sender), "CurvePool: insufficient funds");

        uint256 _totalSupply = totalSupply();

        uint256 currencyAmountToTransfer = amount.mul(currencyBalance()).div(_totalSupply);
        uint256 curveLiquidityAmountToTransfer = amount.mul(totalLiquidityTokenBalance()).div(_totalSupply);

        _burn(msg.sender, amount);

        _lender.distribute(msg.sender, amount, _totalSupply);
        if (currencyAmountToTransfer > 0) {
            require(_currencyToken.transfer(msg.sender, currencyAmountToTransfer));
        }
        if (curveLiquidityAmountToTransfer > 0) {
            ensureEnoughTokensAreAvailable(curveLiquidityAmountToTransfer);
            require(_curvePool.token().transfer(msg.sender, curveLiquidityAmountToTransfer));
        }

        emit Exited(msg.sender, amount);
    }

    /**
     * @dev Deposit idle funds into curve.fi pool and stake in gauge
     */
    function flush(uint256 currencyAmount, uint256 minMintAmount) external onlyOwner {
        require(currencyAmount <= currencyBalance(), "CurvePool: Insufficient currency balance");

        uint256[N_TOKENS] memory amounts = [0, 0, 0, currencyAmount];
        _curvePool.add_liquidity(amounts, minMintAmount);
        _curveGauge.deposit(_curvePool.token().balanceOf(address(this)));

        emit Flushed(currencyAmount);
    }

    /**
     * @dev Remove liquidity from curve
     * @param crvAmount amount of curve pool tokens
     * @param minCurrencyAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 crvAmount, uint256 minCurrencyAmount) external onlyOwner {
        require(crvAmount <= totalLiquidityTokenBalance(), "CurvePool: Insufficient Curve liquidity balance");

        ensureEnoughTokensAreAvailable(crvAmount);
        _curvePool.remove_liquidity_one_coin(crvAmount, TUSD_INDEX, minCurrencyAmount, false);

        emit Pulled(crvAmount);
    }

    /**
     * @dev Remove liquidity from curve and transfer to borrower
     * @param expectedAmount expected amount to borrow
     */
    function borrow(uint256 expectedAmount) external override nonReentrant {
        require(msg.sender == address(_lender), "CurvePool: Only lender can borrow");

        if (expectedAmount > currencyBalance()) {
            uint256 amountToWithdraw = expectedAmount.sub(currencyBalance());
            uint256 roughCurveTokenAmount = calcTokenAmount(amountToWithdraw).mul(1005).div(1000);
            require(
                roughCurveTokenAmount <= totalLiquidityTokenBalance(),
                "CurvePool: Not enough Curve liquidity tokens in pool to cover borrow"
            );
            ensureEnoughTokensAreAvailable(roughCurveTokenAmount);
            _curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, 0, false);
            require(expectedAmount <= currencyBalance(), "CurvePool: Not enough funds in pool to cover borrow");
        }

        require(_currencyToken.transfer(msg.sender, expectedAmount));

        emit Borrow(expectedAmount);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external override {
        require(_currencyToken.transferFrom(msg.sender, address(this), currencyAmount));

        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Collect CRV tokens minted by staking at gauge
     * @param amountOutMin see https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensfortokens
     * @param path see https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensfortokens
     */
    function collectCrv(uint256 amountOutMin, address[] calldata path) external onlyOwner {
        _minter.mint(address(_curveGauge));
        _uniRouter.swapExactTokensForTokens(
            _minter.token().balanceOf(address(this)),
            amountOutMin,
            path,
            address(this),
            block.timestamp + 1 days
        );
    }

    /**
     * @dev Claim fees from the pool
     * @param beneficiary account to send funds to
     */
    function collectFees(address beneficiary) external onlyOwner {
        uint256 amount = claimableFees;
        claimableFees = 0;

        if (amount > 0) {
            require(_currencyToken.transfer(beneficiary, amount));
        }

        emit Collected(beneficiary, amount);
    }

    /**
     * @notice Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
     * Can be used to control slippage
     * @param currencyAmount amount to calculate for
     */
    function calcTokenAmount(uint256 currencyAmount) public view returns (uint256) {
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(_curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return _curvePool.curve().calc_token_amount(yAmounts, true);
    }

    /**
     * @dev Converts the value of a single yCRV into an underlying asset
     * @param crvAmount amount of curve pool tokens to calculate for
     */
    function calcWithdrawOneCoin(uint256 crvAmount) public view returns (uint256) {
        return _curvePool.calc_withdraw_one_coin(crvAmount, TUSD_INDEX);
    }

    /**
     * @dev Currency token balance
     */
    function currencyBalance() internal view returns (uint256) {
        return _currencyToken.balanceOf(address(this)).sub(claimableFees);
    }
}
