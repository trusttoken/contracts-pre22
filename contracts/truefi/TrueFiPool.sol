// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {Ownable} from "../common/UpgradeableOwnable.sol";
import {ICurveGauge, ICurveMinter, ICurvePool} from "./interface/ICurve.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {IUniswapRouter} from "./interface/IUniswapRouter.sol";
import {ABDKMath64x64} from "./Log.sol";
import {ICrvPriceOracle} from "./interface/ICrvPriceOracle.sol";
import {IPauseableContract} from "../common/interface/IPauseableContract.sol";
import {ITrueFiPool2, ITrueFiPoolOracle, ITrueLender2, ILoanToken2, ISAFU} from "../truefi2/interface/ITrueFiPool2.sol";
import {PoolExtensions} from "../truefi2/PoolExtensions.sol";

/**
 * @title TrueFi Pool
 * @dev Lending pool which uses curve.fi to store idle funds
 * Earn high interest rates on currency deposits through uncollateralized loans
 *
 * Funds deposited in this pool are not fully liquid. Liquidity
 * Exiting the pool has 2 options:
 * - withdraw a basket of LoanTokens backing the pool
 * - take an exit penalty depending on pool liquidity
 * After exiting, an account will need to wait for LoanTokens to expire and burn them
 * It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
 *
 * Funds are managed through an external function to save gas on deposits
 */
contract TrueFiPool is ITrueFiPool, IPauseableContract, ERC20, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ICurvePool public _curvePool;
    ICurveGauge public _curveGauge;
    IERC20 public token;
    ITrueLender public _lender;
    ICurveMinter public _minter;
    IUniswapRouter public _uniRouter;

    // fee for deposits
    uint256 public joiningFee;
    // track claimable fees
    uint256 public claimableFees;

    mapping(address => uint256) latestJoinBlock;

    address private DEPRECATED__stakeToken;

    // cache values during sync for gas optimization
    bool private inSync;
    uint256 private yTokenValueCache;
    uint256 private loansValueCache;

    // TRU price oracle
    ITrueFiPoolOracle public oracle;

    // fund manager can call functions to help manage pool funds
    // fund manager can be set to 0 or governance
    address public fundsManager;

    // allow pausing of deposits
    bool public pauseStatus;

    // CRV price oracle
    ICrvPriceOracle public _crvOracle;

    ITrueLender2 public _lender2;

    ISAFU public safu;

    // ======= STORAGE DECLARATION END ============

    // curve.fi data
    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    uint256 constant MAX_PRICE_SLIPPAGE = 10; // 0.1%

    /**
     * @dev Emitted when TrueFi oracle was changed
     * @param newOracle New oracle address
     */
    event TruOracleChanged(ITrueFiPoolOracle newOracle);

    /**
     * @dev Emitted when CRV oracle was changed
     * @param newOracle New oracle address
     */
    event CrvOracleChanged(ICrvPriceOracle newOracle);

    /**
     * @dev Emitted when funds manager is changed
     * @param newManager New manager address
     */
    event FundsManagerChanged(address newManager);

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
     * @dev Emitted when joining is paused or unpaused
     * @param pauseStatus New pausing status
     */
    event PauseStatusChanged(bool pauseStatus);

    /**
     * @dev Emitted when SAFU address is changed
     * @param newSafu New SAFU address
     */
    event SafuChanged(ISAFU newSafu);

    /**
     * @dev only lender can perform borrowing or repaying
     */
    modifier onlyLender() {
        require(msg.sender == address(_lender) || msg.sender == address(_lender2), "TrueFiPool: Caller is not the lender");
        _;
    }

    /**
     * @dev pool can only be joined when it's unpaused
     */
    modifier joiningNotPaused() {
        require(!pauseStatus, "TrueFiPool: Joining the pool is paused");
        _;
    }

    /**
     * @dev only lender can perform borrowing or repaying
     */
    modifier onlyOwnerOrManager() {
        require(msg.sender == owner() || msg.sender == fundsManager, "TrueFiPool: Caller is neither owner nor funds manager");
        _;
    }

    /**
     * @dev ensure than as a result of running a function,
     * balance of `token` increases by at least `expectedGain`
     */
    modifier exchangeProtector(uint256 expectedGain, IERC20 _token) {
        uint256 balanceBefore = _token.balanceOf(address(this));
        _;
        uint256 balanceDiff = _token.balanceOf(address(this)).sub(balanceBefore);
        require(balanceDiff >= conservativePriceEstimation(expectedGain), "TrueFiPool: Not optimal exchange");
    }

    /**
     * Sync values to avoid making expensive calls multiple times
     * Will set inSync to true, allowing getter functions to return cached values
     * Wipes cached values to save gas
     */
    modifier sync() {
        // sync
        yTokenValueCache = yTokenValue();
        loansValueCache = loansValue();
        inSync = true;
        _;
        // wipe
        inSync = false;
        yTokenValueCache = 0;
        loansValueCache = 0;
    }

    function updateNameAndSymbolToLegacy() public {
        updateNameAndSymbol("Legacy TrueFi TrueUSD", "Legacy tfTUSD");
    }

    /// @dev support borrow function from pool V2
    function borrow(uint256 amount) external {
        borrow(amount, 0);
    }

    /**
     * @dev get currency token address
     * @return currency token address
     */
    function currencyToken() public override view returns (IERC20) {
        return token;
    }

    /**
     * @dev set TrueLenderV2
     */
    function setLender2(ITrueLender2 lender2) public onlyOwner {
        require(address(_lender2) == address(0), "TrueFiPool: Lender 2 is already set");
        _lender2 = lender2;
    }

    /**
     * @dev set funds manager address
     */
    function setFundsManager(address newFundsManager) public onlyOwner {
        fundsManager = newFundsManager;
        emit FundsManagerChanged(newFundsManager);
    }

    /**
     * @dev set TrueFi price oracle token address
     * @param newOracle new oracle address
     */
    function setTruOracle(ITrueFiPoolOracle newOracle) public onlyOwner {
        oracle = newOracle;
        emit TruOracleChanged(newOracle);
    }

    /**
     * @dev set CRV price oracle token address
     * @param newOracle new oracle address
     */
    function setCrvOracle(ICrvPriceOracle newOracle) public onlyOwner {
        _crvOracle = newOracle;
        emit CrvOracleChanged(newOracle);
    }

    /**
     * @dev Allow pausing of deposits in case of emergency
     * @param status New deposit status
     */
    function setPauseStatus(bool status) external override onlyOwnerOrManager {
        pauseStatus = status;
        emit PauseStatusChanged(status);
    }

    /**
     * @dev Change SAFU address
     */
    function setSafuAddress(ISAFU _safu) external onlyOwner {
        safu = _safu;
        emit SafuChanged(_safu);
    }

    /**
     * @dev Get total balance of CRV tokens
     * @return Balance of stake tokens in this contract
     */
    function crvBalance() public view returns (uint256) {
        if (address(_minter) == address(0)) {
            return 0;
        }
        return _minter.token().balanceOf(address(this));
    }

    /**
     * @dev Get total balance of curve.fi pool tokens
     * @return Balance of y pool tokens in this contract
     */
    function yTokenBalance() public view returns (uint256) {
        return _curvePool.token().balanceOf(address(this)).add(_curveGauge.balanceOf(address(this)));
    }

    /**
     * @dev Virtual value of yCRV tokens in the pool
     * Will return sync value if inSync
     * @return yTokenValue in USD.
     */
    function yTokenValue() public view returns (uint256) {
        if (inSync) {
            return yTokenValueCache;
        }
        return yTokenBalance().mul(_curvePool.curve().get_virtual_price()).div(1 ether);
    }

    /**
     * @dev Price of CRV in USD
     * @return Oracle price of TRU in USD
     */
    function crvValue() public view returns (uint256) {
        uint256 balance = crvBalance();
        if (balance == 0 || address(_crvOracle) == address(0)) {
            return 0;
        }
        return conservativePriceEstimation(_crvOracle.crvToUsd(balance));
    }

    /**
     * @dev Virtual value of liquid assets in the pool
     * @return Virtual liquid value of pool assets
     */
    function liquidValue() public view returns (uint256) {
        return currencyBalance().add(yTokenValue());
    }

    /**
     * @dev Return pool deficiency value, to be returned by safu
     * @return pool deficiency value
     */
    function deficitValue() public view returns (uint256) {
        if (address(safu) == address(0)) {
            return 0;
        }
        return safu.poolDeficit(address(this));
    }

    /**
     * @dev Calculate pool value in TUSD
     * "virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens
     * @return pool value in USD
     */
    function poolValue() public view returns (uint256) {
        // this assumes defaulted loans are worth their full value
        return liquidValue().add(loansValue()).add(crvValue()).add(deficitValue());
    }

    /**
     * @dev Virtual value of loan assets in the pool
     * Will return cached value if inSync
     * @return Value of loans in pool
     */
    function loansValue() public view returns (uint256) {
        if (inSync) {
            return loansValueCache;
        }
        if (address(_lender2) != address(0)) {
            return _lender.value().add(_lender2.value(ITrueFiPool2(address(this))));
        }
        return _lender.value();
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
     * @dev Join the pool by depositing currency tokens
     * @param amount amount of currency token to deposit
     */
    function join(uint256 amount) external override joiningNotPaused {
        uint256 fee = amount.mul(joiningFee).div(10000);
        uint256 mintedAmount = mint(amount.sub(fee));
        claimableFees = claimableFees.add(fee);

        latestJoinBlock[tx.origin] = block.number;
        require(token.transferFrom(msg.sender, address(this), amount));

        emit Joined(msg.sender, amount, mintedAmount);
    }

    // prettier-ignore
    /**
     * @dev Exit pool
     * This function will withdraw a basket of currencies backing the pool value
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function exit(uint256 amount) external override nonReentrant {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: insufficient funds");

        uint256 _totalSupply = totalSupply();
        uint256 _deficitValue = deficitValue();
        if (_deficitValue > 0) {
            uint256 value = poolValue();
            _totalSupply = _totalSupply.mul(value.sub(_deficitValue)).div(value);
        }

        // get share of currency tokens kept in the pool
        uint256 currencyAmountToTransfer = amount.mul(
            currencyBalance()).div(_totalSupply);

        // calculate amount of curve.fi pool tokens
        uint256 curveLiquidityAmountToTransfer = amount.mul(
            yTokenBalance()).div(_totalSupply);

        // calculate amount of CRV
        uint256 crvTokenAmountToTransfer = amount.mul(
            crvBalance()).div(_totalSupply);

        // burn tokens sent
        _burn(msg.sender, amount);

        // withdraw basket of loan tokens
        _lender.distribute(msg.sender, amount, _totalSupply);
        if (address(_lender2) != address(0)) {
            _lender2.distribute(msg.sender, amount, _totalSupply);
        }

        // if currency remaining, transfer
        if (currencyAmountToTransfer > 0) {
            require(token.transfer(msg.sender, currencyAmountToTransfer));
        }
        // if curve tokens remaining, transfer
        if (curveLiquidityAmountToTransfer > 0) {
            ensureEnoughTokensAreAvailable(curveLiquidityAmountToTransfer);
            require(_curvePool.token().transfer(msg.sender, curveLiquidityAmountToTransfer));
        }

        // if crv remaining, transfer
        if (crvTokenAmountToTransfer > 0) {
            require(_minter.token().transfer(msg.sender, crvTokenAmountToTransfer));
        }

        emit Exited(msg.sender, amount);
    }

    /**
     * @dev Exit pool only with liquid tokens
     * This function will withdraw TUSD but with a small penalty
     * Uses the sync() modifier to reduce gas costs of using curve
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function liquidExit(uint256 amount) external nonReentrant sync {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: Insufficient funds");

        uint256 amountToWithdraw = poolValue().mul(amount).div(totalSupply());
        require(amountToWithdraw <= liquidValue(), "TrueFiPool: Not enough liquidity in pool");

        // burn tokens sent
        _burn(msg.sender, amount);

        if (amountToWithdraw > currencyBalance()) {
            removeLiquidityFromCurve(amountToWithdraw.sub(currencyBalance()));
            require(amountToWithdraw <= currencyBalance(), "TrueFiPool: Not enough funds were withdrawn from Curve");
        }

        require(token.transfer(msg.sender, amountToWithdraw));

        emit Exited(msg.sender, amountToWithdraw);
    }

    /**
     * @dev Deposit idle funds into curve.fi pool and stake in gauge
     * Called by owner to help manage funds in pool and save on gas for deposits
     * @param currencyAmount Amount of funds to deposit into curve
     */
    function flush(uint256 currencyAmount) external {
        require(currencyAmount <= currencyBalance(), "TrueFiPool: Insufficient currency balance");

        uint256 expectedMinYTokenValue = yTokenValue().add(conservativePriceEstimation(currencyAmount));
        _curvePoolDeposit(currencyAmount);
        require(yTokenValue() >= expectedMinYTokenValue, "TrueFiPool: yToken value expected to be higher");
        emit Flushed(currencyAmount);
    }

    function _curvePoolDeposit(uint256 currencyAmount) private {
        uint256[N_TOKENS] memory amounts = [0, 0, 0, currencyAmount];

        token.safeApprove(address(_curvePool), currencyAmount);
        uint256 conservativeMinAmount = calcTokenAmount(currencyAmount).mul(999).div(1000);
        _curvePool.add_liquidity(amounts, conservativeMinAmount);

        // stake yCurve tokens in gauge
        uint256 yBalance = _curvePool.token().balanceOf(address(this));
        _curvePool.token().safeApprove(address(_curveGauge), yBalance);
        _curveGauge.deposit(yBalance);
    }

    /**
     * @dev Remove liquidity from curve
     * @param yAmount amount of curve pool tokens
     * @param minCurrencyAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 yAmount, uint256 minCurrencyAmount) external onlyOwnerOrManager {
        require(yAmount <= yTokenBalance(), "TrueFiPool: Insufficient Curve liquidity balance");

        // unstake in gauge
        ensureEnoughTokensAreAvailable(yAmount);

        // remove TUSD from curve
        _curvePool.token().safeApprove(address(_curvePool), yAmount);
        _curvePool.remove_liquidity_one_coin(yAmount, TUSD_INDEX, minCurrencyAmount, false);

        emit Pulled(yAmount);
    }

    // prettier-ignore
    /**
     * @dev Remove liquidity from curve if necessary and transfer to lender
     * @param amount amount for lender to withdraw
     */
    function borrow(uint256 amount, uint256 fee) public override nonReentrant onlyLender {
        // if there is not enough TUSD, withdraw from curve
        if (amount > currencyBalance()) {
            removeLiquidityFromCurve(amount.sub(currencyBalance()));
            require(amount <= currencyBalance(), "TrueFiPool: Not enough funds in pool to cover borrow");
        }

        mint(fee);
        require(token.transfer(msg.sender, amount.sub(fee)));

        emit Borrow(msg.sender, amount, fee);
    }

    function removeLiquidityFromCurve(uint256 amountToWithdraw) internal {
        // get rough estimate of how much yCRV we should sell
        uint256 roughCurveTokenAmount = calcTokenAmount(amountToWithdraw).mul(1005).div(1000);
        require(roughCurveTokenAmount <= yTokenBalance(), "TrueFiPool: Not enough Curve liquidity tokens in pool to cover borrow");
        // pull tokens from gauge
        ensureEnoughTokensAreAvailable(roughCurveTokenAmount);
        // remove TUSD from curve
        _curvePool.token().safeApprove(address(_curvePool), roughCurveTokenAmount);
        uint256 minAmount = roughCurveTokenAmount.mul(_curvePool.curve().get_virtual_price()).mul(999).div(1000).div(1 ether);
        _curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, minAmount, false);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external override onlyLender {
        require(token.transferFrom(msg.sender, address(this), currencyAmount));
        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Collect CRV tokens minted by staking at gauge
     */
    function collectCrv() external onlyOwnerOrManager {
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
    ) public exchangeProtector(_crvOracle.crvToUsd(amountIn), token) {
        _minter.token().safeApprove(address(_uniRouter), amountIn);
        _uniRouter.swapExactTokensForTokens(amountIn, amountOutMin, path, address(this), block.timestamp + 1 hours);
    }

    /**
     * @dev Claim fees from the pool
     * @param beneficiary account to send funds to
     */
    function collectFees(address beneficiary) external onlyOwnerOrManager {
        uint256 amount = claimableFees;
        claimableFees = 0;

        if (amount > 0) {
            require(token.transfer(beneficiary, amount));
        }

        emit Collected(beneficiary, amount);
    }

    /**
     * @dev Function called by SAFU when liquidation happens. It will transfer all tokens of this loan the SAFU
     */
    function liquidate(ILoanToken2 loan) external {
        PoolExtensions._liquidate(safu, loan, _lender2);
    }

    /**
     * @notice Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
     * Can be used to control slippage
     * Called in flush() function
     * @param currencyAmount amount to calculate for
     * @return expected amount minted given currency amount
     */
    function calcTokenAmount(uint256 currencyAmount) public view returns (uint256) {
        // prettier-ignore
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(
            _curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return _curvePool.curve().calc_token_amount(yAmounts, true);
    }

    /**
     * @dev Currency token balance
     * @return Currency token balance
     */
    function currencyBalance() public view returns (uint256) {
        return token.balanceOf(address(this)).sub(claimableFees);
    }

    /**
     * @param depositedAmount Amount of currency deposited
     * @return amount minted from this transaction
     */
    function mint(uint256 depositedAmount) internal returns (uint256) {
        uint256 mintedAmount = depositedAmount;
        if (mintedAmount == 0) {
            return mintedAmount;
        }

        // first staker mints same amount deposited
        if (totalSupply() > 0) {
            mintedAmount = totalSupply().mul(depositedAmount).div(poolValue());
        }
        // mint pool tokens
        _mint(msg.sender, mintedAmount);

        return mintedAmount;
    }

    /**
     * @dev Calculate price minus max percentage of slippage during exchange
     * This will lead to the pool value become a bit undervalued
     * compared to the oracle price but will ensure that the value doesn't drop
     * when token exchanges are performed.
     */
    function conservativePriceEstimation(uint256 price) internal pure returns (uint256) {
        return price.mul(uint256(10000).sub(MAX_PRICE_SLIPPAGE)).div(10000);
    }
}
