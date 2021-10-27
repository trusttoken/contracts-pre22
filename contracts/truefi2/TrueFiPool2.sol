// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {IFixedTermLoanAgency} from "./interface/IFixedTermLoanAgency.sol";
import {ITrueStrategy} from "./interface/ITrueStrategy.sol";
import {ITrueFiPool2, ITrueFiPoolOracle} from "./interface/ITrueFiPool2.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ILoanToken2Deprecated} from "./deprecated/ILoanToken2Deprecated.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {IPauseableContract} from "../common/interface/IPauseableContract.sol";
import {ISAFU} from "./interface/ISAFU.sol";
import {IDeficiencyToken} from "./interface/IDeficiencyToken.sol";
import {ILineOfCreditAgency} from "./interface/ILineOfCreditAgency.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";

import {ABDKMath64x64} from "../truefi/Log.sol";

/**
 * @title TrueFiPool2
 * @dev Lending pool which may use a strategy to store idle funds
 * Earn high interest rates on currency deposits through uncollateralized loans
 *
 * Funds deposited in this pool are not fully liquid.
 * Exiting incurs an exit penalty depending on pool liquidity
 * After exiting, an account will need to wait for LoanTokens to expire and burn them
 * It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
 *
 * Funds are managed through an external function to save gas on deposits
 */
contract TrueFiPool2 is ITrueFiPool2, IPauseableContract, ERC20, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IDeficiencyToken;
    using SafeERC20 for IDebtToken;

    uint256 private constant BASIS_PRECISION = 10000;

    // max slippage on liquidation token swaps
    // Measured in basis points, e.g. 10000 = 100%
    uint16 public constant TOLERATED_SLIPPAGE = 100; // 1%

    // tolerance difference between
    // expected and actual transaction results
    // when dealing with strategies
    // Measured in  basis points, e.g. 10000 = 100%
    uint16 public constant TOLERATED_STRATEGY_LOSS = 10; // 0.1%

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    uint8 public constant VERSION = 1;

    ERC20 public override token;

    ITrueStrategy public strategy;
    ITrueLender2 public lender;

    // fee for deposits
    // fee precision: 10000 = 100%
    uint256 public joiningFee;
    // track claimable fees
    uint256 public claimableFees;

    mapping(address => uint256) latestJoinBlock;

    address private DEPRECATED__liquidationToken;

    ITrueFiPoolOracle public override oracle;

    // allow pausing of deposits
    bool public pauseStatus;

    // cache values during sync for gas optimization
    bool private inSync;
    uint256 private strategyValueCache;
    uint256 private loansValueCache;

    // who gets all fees
    address public beneficiary;

    address private DEPRECATED__1Inch;

    ISAFU public safu;

    ILineOfCreditAgency public creditAgency;

    uint256 public debtValue;

    IFixedTermLoanAgency public ftlAgency;

    ILoanFactory2 public loanFactory;

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Helper function to concatenate two strings
     * @param a First part of string to concat
     * @param b Second part of string to concat
     * @return Concatenated string of `a` and `b`
     */
    function concat(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function initialize(
        ERC20 _token,
        ITrueLender2 _lender,
        IFixedTermLoanAgency _ftlAgency,
        ISAFU _safu,
        ILoanFactory2 _loanFactory,
        address __owner
    ) external override initializer {
        ERC20.__ERC20_initialize(concat("TrueFi ", _token.name()), concat("tf", _token.symbol()));
        UpgradeableClaimable.initialize(__owner);

        token = _token;
        lender = _lender;
        ftlAgency = _ftlAgency;
        safu = _safu;
        loanFactory = _loanFactory;
    }

    /**
     * @dev Initializer for single borrower pools
     */
    function singleBorrowerInitialize(
        ERC20 _token,
        ITrueLender2 _lender,
        IFixedTermLoanAgency _ftlAgency,
        ISAFU _safu,
        ILoanFactory2 _loanFactory,
        address __owner,
        string memory borrowerName,
        string memory borrowerSymbol
    ) external override initializer {
        ERC20.__ERC20_initialize(
            concat(concat("TrueFi ", borrowerName), concat(" ", _token.name())),
            concat(concat("tf", borrowerSymbol), _token.symbol())
        );
        UpgradeableClaimable.initialize(__owner);

        token = _token;
        lender = _lender;
        ftlAgency = _ftlAgency;
        safu = _safu;
        loanFactory = _loanFactory;
    }

    /**
     * @dev Emitted when fee is changed
     * @param newFee New fee
     */
    event JoiningFeeChanged(uint256 newFee);

    /**
     * @dev Emitted when beneficiary is changed
     * @param newBeneficiary New beneficiary
     */
    event BeneficiaryChanged(address newBeneficiary);

    /**
     * @dev Emitted when oracle is changed
     * @param newOracle New oracle
     */
    event OracleChanged(ITrueFiPoolOracle newOracle);

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
     * @dev Emitted when funds are flushed into the strategy
     * @param currencyAmount Amount of tokens deposited
     */
    event Flushed(uint256 currencyAmount);

    /**
     * @dev Emitted when funds are pulled from the strategy
     * @param minTokenAmount Minimal expected amount received tokens
     */
    event Pulled(uint256 minTokenAmount);

    /**
     * @dev Emitted when funds are borrowed from pool
     * @param borrower Borrower address
     * @param amount Amount of funds borrowed from pool
     */
    event Borrow(address borrower, uint256 amount);

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
     * @dev Emitted when strategy is switched
     * @param newStrategy Strategy to switch to
     */
    event StrategySwitched(ITrueStrategy newStrategy);

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
     * @dev Emitted when pool reclaims deficit from SAFU
     * @param debt Debt for which the deficit was reclaimed
     * @param deficit Amount reclaimed
     */
    event DeficitReclaimed(IDebtToken debt, uint256 deficit);

    /**
     * @dev Emitted when Credit Agency address is changed
     * @param newCreditAgency New Credit Agency address
     */
    event CreditAgencyChanged(ILineOfCreditAgency newCreditAgency);

    /**
     * @dev Emitted when Fixed Term Loan Agency address is changed
     * @param newFTLAgency New Fixed Term Loan Agency address
     */
    event FixedTermLoanAgencyChanged(IFixedTermLoanAgency newFTLAgency);

    /**
     * @dev Emitted when Loan Factory address is changed
     * @param newLoanFactory New Loan Factory address
     */
    event LoanFactoryChanged(ILoanFactory2 newLoanFactory);

    /**
     * @dev Emitted when DebtTokens are added to the pool
     * @param debtToken token address
     * @param amount token amount
     */
    event DebtAdded(IDebtToken debtToken, uint256 amount);

    /**
     * @dev only FixedTermLoanAgency, or CreditAgency can perform borrowing or repaying
     */
    modifier onlyAgencies() {
        require(
            msg.sender == address(ftlAgency) || msg.sender == address(creditAgency),
            "TrueFiPool: Caller is neither the ftlAgency nor creditAgency"
        );
        _;
    }

    /**
     * @dev only TrueLender, FixedTermLoanAgency, or CreditAgency can perform borrowing or repaying
     */
    modifier onlyLenderOrFTLAgencyOrLineOfCreditAgency() {
        require(
            msg.sender == address(lender) || msg.sender == address(ftlAgency) || msg.sender == address(creditAgency),
            "TrueFiPool: Caller is not the lender, ftlAgency, or creditAgency"
        );
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
     * Sync values to avoid making expensive calls multiple times
     * Will set inSync to true, allowing getter functions to return cached values
     * Wipes cached values to save gas
     */
    modifier sync() {
        // sync
        strategyValueCache = strategyValue();
        loansValueCache = loansValue();
        inSync = true;
        _;
        // wipe
        inSync = false;
        strategyValueCache = 0;
        loansValueCache = 0;
    }

    /**
     * @dev Allow pausing of deposits in case of emergency
     * @param status New deposit status
     */
    function setPauseStatus(bool status) external override onlyOwner {
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

    function setCreditAgency(ILineOfCreditAgency _creditAgency) external onlyOwner {
        creditAgency = _creditAgency;
        emit CreditAgencyChanged(_creditAgency);
    }

    function setFixedTermLoanAgency(IFixedTermLoanAgency _ftlAgency) external onlyOwner {
        ftlAgency = _ftlAgency;
        emit FixedTermLoanAgencyChanged(_ftlAgency);
    }

    function setLoanFactory(ILoanFactory2 _loanFactory) external onlyOwner {
        require(address(_loanFactory) != address(0), "TrueFiPool2: loanFactory is zero address");
        loanFactory = _loanFactory;
        emit LoanFactoryChanged(_loanFactory);
    }

    /**
     * @dev Number of decimals for user-facing representations.
     * Delegates to the underlying pool token.
     */
    function decimals() public override view returns (uint8) {
        return token.decimals();
    }

    /**
     * @dev Virtual value of liquid assets in the pool
     * @return Virtual liquid value of pool assets
     */
    function liquidValue() public view returns (uint256) {
        return currencyBalance().add(strategyValue());
    }

    /**
     * @dev Value of funds deposited into the strategy denominated in underlying token
     * @return Virtual value of strategy
     */
    function strategyValue() public view returns (uint256) {
        if (address(strategy) == address(0)) {
            return 0;
        }
        if (inSync) {
            return strategyValueCache;
        }
        return strategy.value();
    }

    /**
     * @dev Calculate pool value in underlying token
     * "virtual price" of entire pool - LoanTokens, UnderlyingTokens, strategy value
     * @return pool value denominated in underlying token
     */
    function poolValue() public override view returns (uint256) {
        // this assumes defaulted loans are worth their full value
        return liquidValue().add(loansValue()).add(deficitValue()).add(creditValue()).add(debtValue);
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
     * @dev Return pool credit line value
     * @return pool credit value
     */
    function creditValue() public view returns (uint256) {
        if (address(creditAgency) == address(0)) {
            return 0;
        }
        return creditAgency.poolCreditValue(ITrueFiPool2(this));
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
        // This conversion does nothing but it silences the slither
        return uint256(lender.value(this)).add(ftlAgency.value(this));
    }

    /**
     * @dev ensure enough tokens are available
     * Check if current available amount of `token` is enough and
     * withdraw remainder from strategy
     * @param neededAmount amount required
     */
    function ensureSufficientLiquidity(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = currencyBalance();
        if (currentlyAvailableAmount < neededAmount) {
            require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy to withdraw from");
            strategy.withdraw(neededAmount.sub(currentlyAvailableAmount));
            require(currencyBalance() >= neededAmount, "TrueFiPool: Not enough funds taken from the strategy");
        }
    }

    /**
     * @dev set pool join fee
     * @param fee new fee
     */
    function setJoiningFee(uint256 fee) external onlyOwner {
        require(fee <= BASIS_PRECISION, "TrueFiPool: Fee cannot exceed transaction value");
        joiningFee = fee;
        emit JoiningFeeChanged(fee);
    }

    /**
     * @dev set beneficiary
     * @param newBeneficiary new beneficiary
     */
    function setBeneficiary(address newBeneficiary) external onlyOwner {
        require(newBeneficiary != address(0), "TrueFiPool: Beneficiary address cannot be set to 0");
        beneficiary = newBeneficiary;
        emit BeneficiaryChanged(newBeneficiary);
    }

    /**
     * @dev Join the pool by depositing tokens
     * @param amount amount of token to deposit
     */
    function join(uint256 amount) external override joiningNotPaused {
        uint256 fee = amount.mul(joiningFee).div(BASIS_PRECISION);
        uint256 mintedAmount = mint(amount.sub(fee));
        claimableFees = claimableFees.add(fee);

        // TODO: tx.origin will be deprecated in a future ethereum upgrade
        latestJoinBlock[tx.origin] = block.number;
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Joined(msg.sender, amount, mintedAmount);
    }

    /**
     * @dev Exit pool only with liquid tokens
     * This function will only transfer underlying token but with a small penalty
     * Uses the sync() modifier to reduce gas costs of using strategy and lender
     * @param amount amount of pool liquidity tokens to redeem for underlying tokens
     */
    function liquidExit(uint256 amount) external sync {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: Insufficient funds");

        uint256 amountToWithdraw = poolValue().mul(amount).div(totalSupply());
        amountToWithdraw = amountToWithdraw.mul(liquidExitPenalty(amountToWithdraw)).div(BASIS_PRECISION);
        require(amountToWithdraw <= liquidValue(), "TrueFiPool: Not enough liquidity in pool");

        // burn tokens sent
        _burn(msg.sender, amount);

        ensureSufficientLiquidity(amountToWithdraw);

        token.safeTransfer(msg.sender, amountToWithdraw);

        emit Exited(msg.sender, amountToWithdraw);
    }

    /**
     * @dev Penalty (in % * 100) applied if liquid exit is performed with this amount
     * returns BASIS_PRECISION (10000) if no penalty
     */
    function liquidExitPenalty(uint256 amount) public view returns (uint256) {
        uint256 lv = liquidValue();
        uint256 pv = poolValue();
        if (amount == pv) {
            return BASIS_PRECISION;
        }
        uint256 liquidRatioBefore = lv.mul(BASIS_PRECISION).div(pv);
        uint256 liquidRatioAfter = lv.sub(amount).mul(BASIS_PRECISION).div(pv.sub(amount));
        return BASIS_PRECISION.sub(averageExitPenalty(liquidRatioAfter, liquidRatioBefore));
    }

    /**
     * @dev Calculates integral of 5/(x+50)dx times 10000
     */
    function integrateAtPoint(uint256 x) public pure returns (uint256) {
        return uint256(ABDKMath64x64.ln(ABDKMath64x64.fromUInt(x.add(50)))).mul(50000).div(2**64);
    }

    /**
     * @dev Calculates average penalty on interval [from; to]
     * @return average exit penalty
     */
    function averageExitPenalty(uint256 from, uint256 to) public pure returns (uint256) {
        require(from <= to, "TrueFiPool: To precedes from");
        if (from == BASIS_PRECISION) {
            // When all liquid, don't penalize
            return 0;
        }
        if (from == to) {
            return uint256(50000).div(from.add(50));
        }
        return integrateAtPoint(to).sub(integrateAtPoint(from)).div(to.sub(from));
    }

    /**
     * @dev Deposit idle funds into strategy
     * @param amount Amount of funds to deposit into strategy
     */
    function flush(uint256 amount) external {
        require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy set up");
        require(amount <= currencyBalance(), "TrueFiPool: Insufficient currency balance");

        uint256 expectedMinStrategyValue = strategy.value().add(withToleratedStrategyLoss(amount));
        token.safeApprove(address(strategy), amount);
        strategy.deposit(amount);
        require(strategy.value() >= expectedMinStrategyValue, "TrueFiPool: Strategy value expected to be higher");
        emit Flushed(amount);
    }

    /**
     * @dev Remove liquidity from strategy
     * @param minTokenAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 minTokenAmount) external onlyOwner {
        require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy set up");

        uint256 expectedCurrencyBalance = currencyBalance().add(minTokenAmount);
        strategy.withdraw(minTokenAmount);
        require(currencyBalance() >= expectedCurrencyBalance, "TrueFiPool: Currency balance expected to be higher");

        emit Pulled(minTokenAmount);
    }

    /**
     * @dev Remove liquidity from strategy if necessary and transfer to lender
     * @param amount amount for lender to withdraw
     */
    function borrow(uint256 amount) external override onlyAgencies {
        require(amount <= liquidValue(), "TrueFiPool: Insufficient liquidity");
        if (amount > 0) {
            ensureSufficientLiquidity(amount);
        }

        token.safeTransfer(msg.sender, amount);

        emit Borrow(msg.sender, amount);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external override onlyLenderOrFTLAgencyOrLineOfCreditAgency {
        token.safeTransferFrom(msg.sender, address(this), currencyAmount);
        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Claim fees from the pool
     */
    function collectFees() external {
        require(beneficiary != address(0), "TrueFiPool: Beneficiary is not set");

        uint256 amount = claimableFees;
        claimableFees = 0;

        if (amount > 0) {
            token.safeTransfer(beneficiary, amount);
        }

        emit Collected(beneficiary, amount);
    }

    /**
     * @dev Switches current strategy to a new strategy
     * @param newStrategy strategy to switch to
     */
    function switchStrategy(ITrueStrategy newStrategy) external onlyOwner {
        require(strategy != newStrategy, "TrueFiPool: Cannot switch to the same strategy");

        ITrueStrategy previousStrategy = strategy;
        strategy = newStrategy;

        if (address(previousStrategy) != address(0)) {
            uint256 expectedMinCurrencyBalance = currencyBalance().add(withToleratedStrategyLoss(previousStrategy.value()));
            previousStrategy.withdrawAll();
            require(currencyBalance() >= expectedMinCurrencyBalance, "TrueFiPool: All funds should be withdrawn to pool");
            require(previousStrategy.value() == 0, "TrueFiPool: Switched strategy should be depleted");
        }

        emit StrategySwitched(newStrategy);
    }

    /**
     * @dev Function called by SAFU when liquidation happens. It will transfer all tokens of this loan the SAFU
     */
    function liquidateLegacyLoan(ILoanToken2Deprecated loan) external override {
        require(msg.sender == address(safu), "TrueFiPool: Should be called by SAFU");
        lender.transferAllLoanTokens(loan, address(safu));
    }

    /**
     * @dev Function called by SAFU when liquidation happens. It will transfer whole balance of the debt token to the SAFU
     */
    function liquidateDebt(IDebtToken debtToken) external override {
        require(msg.sender == address(safu), "TrueFiPool: Should be called by SAFU");
        uint256 balance = debtToken.balanceOf(address(this));
        require(balance > 0, "TrueFiPool: Pool doesn't hold this debt token");

        debtValue = debtValue.sub(balance);
        debtToken.safeTransfer(msg.sender, balance);
    }

    function reclaimLegacyDeficit(ILoanToken2Deprecated loan) external {
        IDeficiencyToken dToken = safu.legacyDeficiencyToken(loan);
        require(address(dToken) != address(0), "TrueFiPool2: No deficiency token found for loan");
        uint256 deficit = dToken.balanceOf(address(this));
        dToken.safeApprove(address(safu), deficit);
        safu.legacyReclaim(loan, deficit);

        emit DeficitReclaimed(IDebtToken(address(loan)), deficit);
    }

    /**
     * @dev Function called when debt is repaid to SAFU, pool has a deficit value towards that debt
     */
    function reclaimDeficit(IDebtToken debt) external {
        IDeficiencyToken dToken = safu.deficiencyToken(debt);
        require(address(dToken) != address(0), "TrueFiPool2: No deficiency token found for debt");
        uint256 deficit = dToken.balanceOf(address(this));
        dToken.safeApprove(address(safu), deficit);
        safu.reclaim(debt, deficit);

        emit DeficitReclaimed(debt, deficit);
    }

    /**
     * @dev CreditAgency transfers DebtToken to the pool
     */
    function addDebt(IDebtToken debtToken, uint256 amount) external override {
        require(
            msg.sender == address(creditAgency) || loanFactory.isLoanToken(ILoanToken2(msg.sender)),
            "TruePool: Only LineOfCreditAgency and Loans can add debtTokens"
        );
        debtValue = debtValue.add(amount);
        debtToken.safeTransferFrom(msg.sender, address(this), amount);

        emit DebtAdded(debtToken, amount);
    }

    /**
     * @dev Change oracle, can only be called by owner
     */
    function setOracle(ITrueFiPoolOracle newOracle) external onlyOwner {
        oracle = newOracle;
        emit OracleChanged(newOracle);
    }

    /**
     * @dev Currency token balance
     * @return Currency token balance
     */
    function currencyBalance() public view returns (uint256) {
        return token.balanceOf(address(this)).sub(claimableFees);
    }

    /**
     * @dev Ratio of liquid assets in the pool after lending
     * @param afterAmountLent Amount of asset being lent
     * @return Calculated ratio in basis points
     */
    function liquidRatio(uint256 afterAmountLent) external override view returns (uint256) {
        uint256 _poolValue = poolValue();
        if (_poolValue == 0) {
            return 0;
        }
        return (liquidValue().sub(afterAmountLent)).mul(BASIS_PRECISION).div(_poolValue);
    }

    /**
     * @param depositedAmount Amount of currency deposited
     * @return amount minted from this transaction
     */
    function mint(uint256 depositedAmount) internal returns (uint256) {
        if (depositedAmount == 0) {
            return depositedAmount;
        }
        uint256 mintedAmount = depositedAmount;

        // first staker mints same amount as deposited
        if (totalSupply() > 0) {
            mintedAmount = totalSupply().mul(depositedAmount).div(poolValue());
        }
        // mint pool liquidity tokens
        _mint(msg.sender, mintedAmount);

        return mintedAmount;
    }

    /**
     * @dev Decrease provided amount percentwise by error
     * @param amount Amount to decrease
     * @return Calculated value
     */
    function withToleratedSlippage(uint256 amount) internal pure returns (uint256) {
        return amount.mul(BASIS_PRECISION - TOLERATED_SLIPPAGE).div(BASIS_PRECISION);
    }

    /**
     * @dev Decrease provided amount percentwise by error
     * @param amount Amount to decrease
     * @return Calculated value
     */
    function withToleratedStrategyLoss(uint256 amount) internal pure returns (uint256) {
        return amount.mul(BASIS_PRECISION - TOLERATED_STRATEGY_LOSS).div(BASIS_PRECISION);
    }
}
