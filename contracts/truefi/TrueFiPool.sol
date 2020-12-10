// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ERC20} from "./common/UpgradeableERC20.sol";
import {Ownable} from "./common/UpgradeableOwnable.sol";
import {ICurveGauge, ICurveMinter, ICurvePool} from "./interface/ICurve.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {IUniswapRouter} from "./interface/IUniswapRouter.sol";

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

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ICurvePool public _curvePool;
    ICurveGauge public _curveGauge;
    IERC20 public _currencyToken;
    ITrueLender public _lender;
    ICurveMinter public _minter;
    IUniswapRouter public _uniRouter;

    // fee for deposits
    uint256 public joiningFee;
    // track claimable fees
    uint256 public claimableFees;

    // ======= STORAGE DECLARATION END ============

    // curve.fi data
    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    /**
     * @dev Emitted when fee is changed
     * @param newFee New fee
     */
    event JoiningFeeChanged(uint256 newFee);

    /**
     * @dev Emitted when someone joins the pool
     * @param staker Account staking
     * @param deposited Amount deposited
     * @param minted Amount of pool tokens minted
     */
    event Joined(address indexed staker, uint256 deposited, uint256 minted);

    /**
     * @dev Emitted when someone exits the pool
     * @param staker Account exiting
     * @param amount Amount unstaking
     */
    event Exited(address indexed staker, uint256 amount);

    /**
     * @dev Emitted when funds are flushed into curve.fi
     * @param currencyAmount Amount of tokens deposited
     */
    event Flushed(uint256 currencyAmount);

    /**
     * @dev Emitted when funds are pulled from curve.fi
     * @param yAmount Amount of pool tokens
     */
    event Pulled(uint256 yAmount);

    /**
     * @dev Emitted when funds are borrowed from pool
     * @param borrower Borrower address
     * @param amount Amount of funds borrowed from pool
     * @param fee Fees collected from this transaction
     */
    event Borrow(address borrower, uint256 amount, uint256 fee);

    /**
     * @dev Emitted when borrower repays the pool
     * @param payer Address of borrower
     * @param amount Amount repaid
     */
    event Repaid(address indexed payer, uint256 amount);

    /**
     * @dev Emitted when fees are collected
     * @param beneficiary Account to receive fees
     * @param amount Amount of fees collected
     */
    event Collected(address indexed beneficiary, uint256 amount);

    /**
     * @dev Initialize pool
     * @param __curvePool curve pool address
     * @param __curveGauge curve gauge address
     * @param __currencyToken curve pool underlying token
     * @param __lender TrueLender address
     * @param __uniRouter Uniswap router
     */
    function initialize(
        ICurvePool __curvePool,
        ICurveGauge __curveGauge,
        IERC20 __currencyToken,
        ITrueLender __lender,
        IUniswapRouter __uniRouter
    ) public initializer {
        ERC20.__ERC20_initialize("TrueFi LP", "TFI-LP");
        Ownable.initialize();

        _curvePool = __curvePool;
        _curveGauge = __curveGauge;
        _currencyToken = __currencyToken;
        _lender = __lender;
        _minter = _curveGauge.minter();
        _uniRouter = __uniRouter;

        joiningFee = 25;

        _currencyToken.approve(address(_curvePool), uint256(-1));
        _curvePool.token().approve(address(_curvePool), uint256(-1));
    }

    /**
     * @dev only lender can perform borrowing or repaying
     */
    modifier onlyLender() {
        require(msg.sender == address(_lender), "TrueFiPool: Only lender can borrow or repay");
        _;
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
    function yTokenBalance() public view returns (uint256) {
        return _curvePool.token().balanceOf(address(this)).add(_curveGauge.balanceOf(address(this)));
    }

    /**
     * @dev Calculate pool value in TUSD
     * "virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens
     * @return pool value in TUSD
     */
    function poolValue() public view returns (uint256) {
        // prettier-ignore
        return
            currencyBalance()
            .add(_lender.value())
            .add(
                yTokenBalance()
                .mul(_curvePool.curve().get_virtual_price())
                .div(1 ether));
    }

    /**
     * @dev ensure enough curve.fi pool tokens are available
     * Check if current available amount of TUSD is enough and
     * withdraw remainder from gauge
     * @param neededAmount amount required
     */
    function ensureEnoughTokensAreAvailable(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = _curvePool.token().balanceOf(address(this));
        if (currentlyAvailableAmount < neededAmount) {
            _curveGauge.withdraw(neededAmount.sub(currentlyAvailableAmount));
        }
    }

    /**
     * @dev set pool join fee
     * @param fee new fee
     */
    function setJoiningFee(uint256 fee) external onlyOwner {
        require(fee <= 10000, "TrueFiPool: Fee cannot exceed transaction value");
        joiningFee = fee;
        emit JoiningFeeChanged(fee);
    }

    /**
     * @dev Function to approve curve gauge to spend y pool tokens
     */
    function approveCurve() external onlyOwner {
        _curvePool.token().approve(address(_curveGauge), uint256(-1));
    }

    /**
     * @dev Join the pool by depositing currency tokens
     * @param amount amount of currency token to deposit
     */
    function join(uint256 amount) external override {
        uint256 fee = amount.mul(joiningFee).div(10000);
        uint256 amountToDeposit = amount.sub(fee);
        uint256 amountToMint = amountToDeposit;

        // first staker mints same amount deposited
        if (totalSupply() > 0) {
            amountToMint = totalSupply().mul(amountToDeposit).div(poolValue());
        }
        // mint pool tokens
        _mint(msg.sender, amountToMint);
        claimableFees = claimableFees.add(fee);

        require(_currencyToken.transferFrom(msg.sender, address(this), amount));

        emit Joined(msg.sender, amount, amountToMint);
    }

    // prettier-ignore
    /**
     * @dev Exit pool
     * This function will withdraw a basket of currencies backing the pool value
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function exit(uint256 amount) external override nonReentrant {
        require(amount <= balanceOf(msg.sender), "TrueFiPool: insufficient funds");

        uint256 _totalSupply = totalSupply();

        // get share of currency tokens kept in the pool
        uint256 currencyAmountToTransfer = amount.mul(
            currencyBalance()).div(_totalSupply);

        // calculate amount of curve.fi pool tokens
        uint256 curveLiquidityAmountToTransfer = amount.mul(
            yTokenBalance()).div(_totalSupply);

        // burn tokens sent
        _burn(msg.sender, amount);

        // withdraw basket of loan tokens
        _lender.distribute(msg.sender, amount, _totalSupply);

        // if currency remaining, transfer
        if (currencyAmountToTransfer > 0) {
            require(_currencyToken.transfer(msg.sender, currencyAmountToTransfer));
        }
        // if curve tokens remaining, transfer
        if (curveLiquidityAmountToTransfer > 0) {
            ensureEnoughTokensAreAvailable(curveLiquidityAmountToTransfer);
            require(_curvePool.token().transfer(msg.sender, curveLiquidityAmountToTransfer));
        }

        emit Exited(msg.sender, amount);
    }

    /**
     * @dev Deposit idle funds into curve.fi pool and stake in gauge
     * Called by owner to help manage funds in pool and save on gas for deposits
     * @param currencyAmount Amount of funds to deposit into curve
     * @param minMintAmount Minimum amount to mint
     */
    function flush(uint256 currencyAmount, uint256 minMintAmount) external onlyOwner {
        require(currencyAmount <= currencyBalance(), "TrueFiPool: Insufficient currency balance");

        uint256[N_TOKENS] memory amounts = [0, 0, 0, currencyAmount];

        // add TUSD to curve
        _curvePool.add_liquidity(amounts, minMintAmount);

        // stake yCurve tokens in gauge
        _curveGauge.deposit(_curvePool.token().balanceOf(address(this)));

        emit Flushed(currencyAmount);
    }

    /**
     * @dev Remove liquidity from curve
     * @param yAmount amount of curve pool tokens
     * @param minCurrencyAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 yAmount, uint256 minCurrencyAmount) external onlyOwner {
        require(yAmount <= yTokenBalance(), "TrueFiPool: Insufficient Curve liquidity balance");

        // unstake in gauge
        ensureEnoughTokensAreAvailable(yAmount);

        // remove TUSD from curve
        _curvePool.remove_liquidity_one_coin(yAmount, TUSD_INDEX, minCurrencyAmount, false);

        emit Pulled(yAmount);
    }

    // prettier-ignore
    /**
     * @dev Remove liquidity from curve and transfer to borrower
     * @param expectedAmount expected amount to borrow
     */
    function borrow(uint256 expectedAmount, uint256 amountWithoutFee) external override nonReentrant onlyLender {
        require(expectedAmount >= amountWithoutFee, "TrueFiPool: Fee cannot be negative");

        // if there is not enough TUSD, withdraw from curve
        if (expectedAmount > currencyBalance()) {
            // get rough estimate of how much TUSD we'll get back from curve
            uint256 amountToWithdraw = expectedAmount.sub(currencyBalance());
            uint256 roughCurveTokenAmount = calcTokenAmount(amountToWithdraw).mul(1005).div(1000);
            require(
                roughCurveTokenAmount <= yTokenBalance(),
                "TrueFiPool: Not enough Curve y tokens in pool to cover borrow"
            );
            // pull tokens from gauge
            ensureEnoughTokensAreAvailable(roughCurveTokenAmount);
            // remove TUSD from curve
            _curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, 0, false);
            require(expectedAmount <= currencyBalance(), "TrueFiPool: Not enough funds in pool to cover borrow");
        }

        // calculate fees and transfer remainder
        uint256 fee = expectedAmount.sub(amountWithoutFee);
        claimableFees = claimableFees.add(fee);
        require(_currencyToken.transfer(msg.sender, amountWithoutFee));

        emit Borrow(msg.sender, expectedAmount, fee);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external override onlyLender {
        require(_currencyToken.transferFrom(msg.sender, address(this), currencyAmount));
        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Collect CRV tokens minted by staking at gauge
     */
    function collectCrv() external onlyOwner {
        _minter.mint(address(_curveGauge));
    }

    /**
     * @dev Sell collected CRV on Uniswap
     * - Selling CRV is managed by the contract owner
     * - Calculations can be made off-chain and called based on market conditions
     * - Need to pass path of exact pairs to go through while executing exchange
     * For example, CRV -> WETH -> TUSD
     *
     * @param amountIn see https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensfortokens
     * @param amountOutMin see https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensfortokens
     * @param path see https://uniswap.org/docs/v2/smart-contracts/router02/#swapexacttokensfortokens
     */
    function sellCrv(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path
    ) public onlyOwner {
        _minter.token().approve(address(_uniRouter), amountIn);
        _uniRouter.swapExactTokensForTokens(amountIn, amountOutMin, path, address(this), block.timestamp + 1 hours);
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
     * Called in flush() function
     * @param currencyAmount amount to calculate for
     */
    function calcTokenAmount(uint256 currencyAmount) public view returns (uint256) {
        // prettier-ignore
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(
            _curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return _curvePool.curve().calc_token_amount(yAmounts, true);
    }

    /**
     * @dev Converts the value of a single yCRV into an underlying asset
     * @param yAmount amount of curve pool tokens to calculate for
     * @return Value of one y pool token
     */
    function calcWithdrawOneCoin(uint256 yAmount) public view returns (uint256) {
        return _curvePool.calc_withdraw_one_coin(yAmount, TUSD_INDEX);
    }

    /**
     * @dev Currency token balance
     * @return Currency token balance
     */
    function currencyBalance() internal view returns (uint256) {
        return _currencyToken.balanceOf(address(this)).sub(claimableFees);
    }
}
