// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {OneInchExchange} from "./libraries/OneInchExchange.sol";

import {IFixedTermLoan} from "./interface/IFixedTermLoan.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {IFixedTermLoanAgency} from "./interface/IFixedTermLoanAgency.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {I1Inch3} from "./interface/I1Inch3.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {IRateModel} from "./interface/IRateModel.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {IStakingVault} from "./interface/IStakingVault.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

/**
 * @title FixedTermLoanAgency
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * FixedTermLoanAgency holds all LoanTokens
 */
contract FixedTermLoanAgency is IFixedTermLoanAgency, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IERC20WithDecimals;
    using SafeERC20 for ITrueFiPool2;
    using OneInchExchange for I1Inch3;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    uint256 private constant ONE_INCH_PARTIAL_FILL_FLAG = 0x01;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => IFixedTermLoan[]) public poolLoans;

    // maximum amount of loans agency can handle at once
    uint256 public maxLoans;

    // which part of interest should be paid to the stakers
    uint256 public fee;

    IStakingPool public stakingPool;

    IPoolFactory public poolFactory;

    I1Inch3 public _1inch;

    // Loan fees should be swapped for this token, deposited into the feePool
    // and pool's LP tokens should be sent to the stakers
    IERC20WithDecimals public feeToken;
    ITrueFiPool2 public feePool;

    // Minimal possible fee swap slippage
    // basis precision: 10000 = 100%
    uint256 public swapFeeSlippage;

    ITrueFiCreditOracle public creditOracle;

    uint256 public maxLoanTerm;

    uint256 public longTermLoanThreshold;

    uint8 public longTermLoanScoreThreshold;

    IRateModel public rateModel;

    // mutex ensuring there's only one running loan or credit line for borrower
    IBorrowingMutex public borrowingMutex;

    ILoanFactory2 public loanFactory;

    mapping(address => bool) public isBorrowerAllowed;

    IStakingVault public stakingVault;

    mapping(address => IFixedTermLoan[]) public borrowerLoans;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when loans limit is changed
     * @param maxLoans new maximum amount of loans
     */
    event LoansLimitChanged(uint256 maxLoans);

    /**
     * @dev Emitted when max loan term changed
     * @param maxLoanTerm New max loan term
     */
    event MaxLoanTermChanged(uint256 maxLoanTerm);

    /**
     * @dev Emitted when long term loan's minimal term changed
     * @param longTermLoanThreshold New long term loan minimal term
     */
    event LongTermLoanThresholdChanged(uint256 longTermLoanThreshold);

    /**
     * @dev Emitted when minimal credit score threshold for long term loan changed
     * @param longTermLoanScoreThreshold New minimal credit score threshold for long term loan
     */
    event LongTermLoanScoreThresholdChanged(uint256 longTermLoanScoreThreshold);

    /**
     * @dev Emitted when loan fee is changed
     * @param newFee New fee value in basis points
     */
    event FeeChanged(uint256 newFee);

    /**
     * @dev Emitted when fee pool is changed
     * @param newFeePool New fee pool address
     */
    event FeePoolChanged(ITrueFiPool2 newFeePool);

    /**
     * @dev Emitted when credit oracle is changed
     * @param newCreditOracle New credit oracle address
     */
    event CreditOracleChanged(ITrueFiCreditOracle newCreditOracle);

    /**
     * @dev Emitted when a loan is funded
     * @param loanToken LoanToken contract which was funded
     * @param amount Amount funded
     */
    event Funded(address indexed pool, address loanToken, uint256 amount);

    /**
     * @dev Emitted when funds are reclaimed from the LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     * @param amount Amount repaid
     */
    event Reclaimed(address indexed pool, address loanToken, uint256 amount);

    /**
     * @dev Emitted when borrowingMutex address is changed
     * @param borrowingMutex new borrowingMutex address
     */
    event BorrowingMutexChanged(IBorrowingMutex borrowingMutex);

    event BorrowerAllowed(address indexed who);
    event BorrowerBlocked(address indexed who);

    /**
     * @dev Can be only called by a pool
     */
    modifier onlySupportedPool() {
        require(poolFactory.isSupportedPool(ITrueFiPool2(msg.sender)), "FixedTermLoanAgency: Pool not supported by the factory");
        _;
    }

    modifier onlyAllowedBorrowers() {
        require(isBorrowerAllowed[msg.sender], "FixedTermLoanAgency: Sender is not allowed to borrow");
        _;
    }

    /**
     * @dev Initialize the contract with parameters
     * @param _stakingPool stkTRU address
     * @param _poolFactory PoolFactory address
     * @param __1inch 1Inch exchange address (0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     */
    function initialize(
        IStakingPool _stakingPool,
        IPoolFactory _poolFactory,
        I1Inch3 __1inch,
        ITrueFiCreditOracle _creditOracle,
        IRateModel _rateModel,
        IBorrowingMutex _borrowingMutex,
        ILoanFactory2 _loanFactory,
        IStakingVault _stakingVault
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        stakingPool = _stakingPool;
        poolFactory = _poolFactory;
        _1inch = __1inch;
        creditOracle = _creditOracle;
        rateModel = _rateModel;
        borrowingMutex = _borrowingMutex;
        loanFactory = _loanFactory;
        stakingVault = _stakingVault;

        swapFeeSlippage = 100; // 1%
        fee = 1000;
        maxLoans = 100;
        maxLoanTerm = 180 days;
        longTermLoanThreshold = 90 days;
        longTermLoanScoreThreshold = 200;
    }

    /**
     * @dev Set new credit oracle address.
     * Only owner can change credit oracle
     * @param _creditOracle new credit oracle
     */
    function setCreditOracle(ITrueFiCreditOracle _creditOracle) external onlyOwner {
        require(address(_creditOracle) != address(0), "FixedTermLoanAgency: CreditOracle cannot be set to zero address");
        creditOracle = _creditOracle;
        emit CreditOracleChanged(_creditOracle);
    }

    /**
     * @dev set borrowingMutex
     * @param newMutex borrowing mutex address to be set
     */
    function setBorrowingMutex(IBorrowingMutex newMutex) public onlyOwner {
        require(address(newMutex) != address(0), "FixedTermLoanAgency: BorrowingMutex cannot be set to zero address");
        borrowingMutex = newMutex;
        emit BorrowingMutexChanged(newMutex);
    }

    /**
     * @dev Set max loan term. Only owner can change parameters.
     * @param _maxLoanTerm New maxLoanTerm
     */
    function setMaxLoanTerm(uint256 _maxLoanTerm) external onlyOwner {
        maxLoanTerm = _maxLoanTerm;
        emit MaxLoanTermChanged(_maxLoanTerm);
    }

    /**
     * @dev Set minimal term of a long term loan. Only owner can change parameters.
     * @param _longTermLoanThreshold New longTermLoanThreshold
     */
    function setLongTermLoanThreshold(uint256 _longTermLoanThreshold) external onlyOwner {
        longTermLoanThreshold = _longTermLoanThreshold;
        emit LongTermLoanThresholdChanged(_longTermLoanThreshold);
    }

    /**
     * @dev Set long term loan credit score threshold. Only owner can change parameters.
     * @param _longTermLoanScoreThreshold New longTermLoanScoreThreshold
     */
    function setLongTermLoanScoreThreshold(uint8 _longTermLoanScoreThreshold) external onlyOwner {
        longTermLoanScoreThreshold = _longTermLoanScoreThreshold;
        emit LongTermLoanScoreThresholdChanged(_longTermLoanScoreThreshold);
    }

    /**
     * @dev Set new loans limit. Only owner can change parameters.
     * @param newLoansLimit New loans limit
     */
    function setLoansLimit(uint256 newLoansLimit) external onlyOwner {
        maxLoans = newLoansLimit;
        emit LoansLimitChanged(maxLoans);
    }

    /**
     * @dev Set new fee pool and fee token.
     * Only owner can change parameters
     * @param newFeePool new pool address
     */
    function setFeePool(ITrueFiPool2 newFeePool) external onlyOwner {
        feeToken = IERC20WithDecimals(address(newFeePool.token()));
        feePool = newFeePool;
        emit FeePoolChanged(newFeePool);
    }

    /**
     * @dev Set loan interest fee that goes to the stakers.
     * @param newFee New loans limit
     */
    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= BASIS_RATIO, "FixedTermLoanAgency: fee cannot be more than 100%");
        fee = newFee;
        emit FeeChanged(newFee);
    }

    function allowBorrower(address who) external onlyOwner {
        isBorrowerAllowed[who] = true;
        emit BorrowerAllowed(who);
    }

    function blockBorrower(address who) external onlyOwner {
        isBorrowerAllowed[who] = false;
        emit BorrowerBlocked(who);
    }

    /**
     * @dev Get currently funded loans for a pool
     * @param pool pool address
     * @return result Array of loans currently funded
     */
    function loans(ITrueFiPool2 pool) public view returns (IFixedTermLoan[] memory result) {
        result = poolLoans[pool];
    }

    function rate(
        ITrueFiPool2 pool,
        address borrower,
        uint256 amount,
        uint256 term
    ) public view returns (uint256) {
        uint8 rawScore = creditOracle.score(borrower);
        uint256 stakedAmount = stakingVault.stakedAmount(borrower);
        uint8 effectiveScore = rateModel.effectiveScore(pool, rawScore, stakedAmount, amount);
        uint256 fixedTermLoanAdjustment = rateModel.fixedTermLoanAdjustment(term);
        return rateModel.rate(pool, effectiveScore, amount).add(fixedTermLoanAdjustment);
    }

    /**
     * @dev Create and fund a loan via LoanFactory for a pool supported by PoolFactory
     * Method should be called by the loan borrower
     *
     * When called, agency takes funds from the pool, gives it to the loan and holds all LoanTokens
     * Origination fee is transferred to the stake
     */
    function borrow(
        ITrueFiPool2 pool,
        uint256 amount,
        uint256 term,
        uint256 _maxApy
    ) external onlyAllowedBorrowers {
        require(poolFactory.isSupportedPool(pool), "FixedTermLoanAgency: Pool not supported by the factory");
        require(poolLoans[pool].length < maxLoans, "FixedTermLoanAgency: Loans number has reached the limit");

        address borrower = msg.sender;
        require(borrowingMutex.isUnlocked(borrower), "FixedTermLoanAgency: There is an ongoing loan or credit line");
        require(
            creditOracle.status(borrower) == ITrueFiCreditOracle.Status.Eligible,
            "FixedTermLoanAgency: Sender is not eligible for loan"
        );

        require(amount > 0, "FixedTermLoanAgency: Loans of amount 0, will not be approved");
        require(
            pool.oracle().tokenToUsd(amount) <= borrowLimit(pool, borrower),
            "FixedTermLoanAgency: Loan amount cannot exceed borrow limit"
        );

        require(term > 0, "FixedTermLoanAgency: Loans cannot have instantaneous term of repay");
        require(isTermBelowMax(term), "FixedTermLoanAgency: Loan's term is too long");
        require(isCredibleForTerm(term), "FixedTermLoanAgency: Credit score is too low for loan's term");

        uint256 apy = rate(pool, borrower, amount, term);
        require(apy <= _maxApy, "FixedTermLoanAgency: Calculated apy is higher than max apy");

        IFixedTermLoan loanToken = loanFactory.createLoanToken(pool, borrower, amount, term, apy);
        borrowerLoans[borrower].push(loanToken);
        borrowingMutex.lock(borrower, address(this));
        poolLoans[pool].push(loanToken);
        pool.borrow(amount);
        pool.token().safeTransfer(borrower, amount);

        emit Funded(address(pool), address(loanToken), amount);
    }

    /**
     * @dev Loop through loan tokens for the pool and calculate theoretical value of all loans
     * There should never be too many loans in the pool to run out of gas
     * @param pool pool address
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value(ITrueFiPool2 pool) external override view returns (uint256) {
        IFixedTermLoan[] memory _loans = poolLoans[pool];
        uint256 totalValue;
        for (uint256 index = 0; index < _loans.length; index++) {
            totalValue = totalValue.add(_loans[index].currentValue(address(this)));
        }
        return totalValue;
    }

    /**
     * @dev For settled loans, redeem LoanTokens for underlying funds
     * @param loanToken Loan to reclaim capital from (must be previously funded)
     */
    function reclaim(IFixedTermLoan loanToken, bytes calldata data) external {
        IFixedTermLoan.Status status = loanToken.status();
        require(
            status == IFixedTermLoan.Status.Settled || status == IFixedTermLoan.Status.Defaulted,
            "FixedTermLoanAgency: LoanToken is not closed yet"
        );
        if (status == IFixedTermLoan.Status.Defaulted) {
            require(msg.sender == owner(), "FixedTermLoanAgency: Only owner can reclaim from defaulted loan");
        }

        // find the token, repay loan and remove loan from loan array
        ITrueFiPool2 pool = loanToken.pool();
        IFixedTermLoan[] storage _loans = poolLoans[pool];
        uint256 loansLength = _loans.length;
        for (uint256 index = 0; index < loansLength; index++) {
            if (_loans[index] == loanToken) {
                _loans[index] = _loans[loansLength - 1];
                _loans.pop();
                borrowerLoans[loanToken.borrower()].pop();

                uint256 fundsReclaimed = _redeemAndRepay(loanToken, pool, data);
                emit Reclaimed(address(pool), address(loanToken), fundsReclaimed);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        // This prevents invalid loans from being reclaimed
        revert("FixedTermLoanAgency: This loan has not been funded by the agency");
    }

    /**
     * @dev Get total amount borrowed for `borrower` from fixed term loans in USD
     * Total borrowed amount would be 0 if no Fixed Term Loan is taken by the borrower at the moment
     * And total loan amount + interest otherwise.
     * @param borrower Borrower to get amount borrowed for
     * @param decimals Precision to use when calculating total borrowed
     * @return Total amount borrowed for `borrower` in USD
     */
    function totalBorrowed(address borrower, uint8 decimals) public view returns (uint256) {
        IFixedTermLoan _loan;
        if (borrowerLoans[borrower].length > 0) {
            _loan = borrowerLoans[borrower][0];
        } else {
            return 0;
        }
        if (!loanFactory.isLoanToken(_loan)) {
            return 0;
        }
        uint256 borrowed = _loan.debt();
        uint256 resultPrecision = uint256(10)**decimals;

        return _loan.pool().oracle().tokenToUsd(borrowed).mul(resultPrecision).div(1 ether);
    }

    /**
     * @dev Get borrow limit for `borrower` in `pool` using rate model
     * @param pool Pool to get borrow limit for
     * @param borrower Borrower to get borrow limit for
     * @return borrow limit for `borrower` in `pool`
     */
    function borrowLimit(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        uint8 poolDecimals = ITrueFiPool2WithDecimals(address(pool)).decimals();
        return
            rateModel.borrowLimit(
                pool,
                creditOracle.score(borrower),
                creditOracle.maxBorrowerLimit(borrower),
                stakingVault.stakedAmount(borrower),
                totalBorrowed(borrower, poolDecimals)
            );
    }

    function banBorrower(address borrower) external override {
        require(loanFactory.isLoanToken(IFixedTermLoan(msg.sender)), "");
        borrowingMutex.ban(borrower);
    }

    /**
     * @dev Helper function to redeem funds from `loanToken` and repay them into the `pool`
     * @param loanToken Loan to reclaim capital from
     * @param pool Pool from which the loan was funded
     */
    function _redeemAndRepay(
        IFixedTermLoan loanToken,
        ITrueFiPool2 pool,
        bytes calldata data
    ) internal returns (uint256) {
        // call redeem function on LoanToken
        uint256 balanceBefore = pool.token().balanceOf(address(this));
        loanToken.redeem();
        uint256 balanceAfter = pool.token().balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        uint256 fundsReclaimed = balanceAfter.sub(balanceBefore);

        uint256 feeAmount;
        if (address(feeToken) != address(0)) {
            // swap fee for feeToken
            feeAmount = _swapFee(pool, loanToken, data);
        }
        borrowingMutex.unlock(loanToken.borrower());

        pool.token().safeApprove(address(pool), fundsReclaimed.sub(feeAmount));
        pool.repay(fundsReclaimed.sub(feeAmount));

        if (address(feeToken) != address(0)) {
            // join pool and reward stakers
            _transferFeeToStakers();
        }
        return fundsReclaimed;
    }

    /// @dev Swap `token` for `feeToken` on 1inch
    function _swapFee(
        ITrueFiPool2 pool,
        IFixedTermLoan loanToken,
        bytes calldata data
    ) internal returns (uint256) {
        uint256 feeAmount = loanToken.interest().mul(fee).div(BASIS_RATIO);
        IERC20WithDecimals token = IERC20WithDecimals(address(pool.token()));
        if (token == feeToken) {
            return feeAmount;
        }
        if (feeAmount == 0) {
            return 0;
        }
        (I1Inch3.SwapDescription memory swap, uint256 balanceDiff) = _1inch.exchange(data);
        uint256 expectedDiff = pool.oracle().tokenToUsd(feeAmount).mul(uint256(10)**feeToken.decimals()).div(1 ether);

        require(swap.srcToken == address(token), "FixedTermLoanAgency: Source token is not same as pool's token");
        require(swap.dstToken == address(feeToken), "FixedTermLoanAgency: Destination token is not fee token");
        require(swap.dstReceiver == address(this), "FixedTermLoanAgency: Receiver is not agency");
        require(swap.amount == feeAmount, "FixedTermLoanAgency: Incorrect fee swap amount");
        require(swap.flags & ONE_INCH_PARTIAL_FILL_FLAG == 0, "FixedTermLoanAgency: Partial fill is not allowed");
        require(
            balanceDiff >= expectedDiff.mul(BASIS_RATIO.sub(swapFeeSlippage)).div(BASIS_RATIO),
            "FixedTermLoanAgency: Fee returned from swap is too small"
        );

        return feeAmount;
    }

    /// @dev Deposit feeToken to pool and transfer LP tokens to the stakers
    function _transferFeeToStakers() internal {
        uint256 amount = feeToken.balanceOf(address(this));
        if (amount == 0) {
            return;
        }
        feeToken.safeApprove(address(feePool), amount);
        feePool.join(amount);
        feePool.safeTransfer(address(stakingPool), feePool.balanceOf(address(this)));
    }

    function isCredibleForTerm(uint256 term) internal view returns (bool) {
        return term <= longTermLoanThreshold || creditOracle.score(msg.sender) >= longTermLoanScoreThreshold;
    }

    function isTermBelowMax(uint256 term) internal view returns (bool) {
        return term <= maxLoanTerm;
    }
}
