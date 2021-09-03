// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {OneInchExchange} from "./libraries/OneInchExchange.sol";

import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IDebtToken} from "../truefi2/interface/ILoanToken2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ITrueFiPool2, ITrueFiPoolOracle, I1Inch3} from "./interface/ITrueFiPool2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ITrueRatingAgency} from "../truefi/interface/ITrueRatingAgency.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

/**
 * @title TrueLender v2.0
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * TrueLender holds all LoanTokens and may distribute them on pool exits
 */
contract TrueLender2 is ITrueLender2, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IERC20WithDecimals;
    using SafeERC20 for ITrueFiPool2;
    using SafeERC20 for ILoanToken2;
    using OneInchExchange for I1Inch3;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    uint256 private constant ONE_INCH_PARTIAL_FILL_FLAG = 0x01;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => ILoanToken2[]) public poolLoans;

    // maximum amount of loans lender can handle at once
    uint256 public maxLoans;

    // which part of interest should be paid to the stakers
    uint256 public fee;

    IStakingPool public stakingPool;

    IPoolFactory public factory;

    ITrueRatingAgency public DEPRECATED__ratingAgency;

    I1Inch3 public _1inch;

    // Loan fees should be swapped for this token, deposited into the feePool
    // and pool's LP tokens should be sent to the stakers
    IERC20WithDecimals public feeToken;
    ITrueFiPool2 public feePool;

    // Minimal possible fee swap slippage
    // basis precision: 10000 = 100%
    uint256 public swapFeeSlippage;

    // ===== Voting parameters =====

    // How many votes are needed for a loan to be approved
    uint256 public DEPRECATED__minVotes;

    // Minimum ratio of yes votes to total votes for a loan to be approved
    // basis precision: 10000 = 100%
    uint256 public DEPRECATED__minRatio;

    // minimum prediction market voting period
    uint256 public DEPRECATED__votingPeriod;

    ITrueFiCreditOracle public creditOracle;

    uint256 public maxLoanTerm;

    uint256 public longTermLoanThreshold;

    uint8 public longTermLoanScoreThreshold;

    ITrueRateAdjuster public rateAdjuster;

    // mutex ensuring there's only one running loan or credit line for borrower
    IBorrowingMutex public borrowingMutex;

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

    /**
     * @dev Can be only called by a pool
     */
    modifier onlySupportedPool() {
        require(factory.isSupportedPool(ITrueFiPool2(msg.sender)), "TrueLender: Pool not supported by the factory");
        _;
    }

    /**
     * @dev Initialize the contract with parameters
     * @param _stakingPool stkTRU address
     * @param _factory PoolFactory address
     * @param __1inch 1Inch exchange address (0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     */
    function initialize(
        IStakingPool _stakingPool,
        IPoolFactory _factory,
        I1Inch3 __1inch,
        ITrueFiCreditOracle _creditOracle,
        ITrueRateAdjuster _rateAdjuster,
        IBorrowingMutex _borrowingMutex
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        stakingPool = _stakingPool;
        factory = _factory;
        _1inch = __1inch;
        creditOracle = _creditOracle;
        rateAdjuster = _rateAdjuster;
        borrowingMutex = _borrowingMutex;

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
        creditOracle = _creditOracle;
        emit CreditOracleChanged(_creditOracle);
    }

    /**
     * @dev set borrowingMutex
     * @param newMutex borrowing mutex address to be set
     */
    function setBorrowingMutex(IBorrowingMutex newMutex) public onlyOwner {
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
        require(newFee <= BASIS_RATIO, "TrueLender: fee cannot be more than 100%");
        fee = newFee;
        emit FeeChanged(newFee);
    }

    /**
     * @dev Get currently funded loans for a pool
     * @param pool pool address
     * @return result Array of loans currently funded
     */
    function loans(ITrueFiPool2 pool) public view returns (ILoanToken2[] memory result) {
        result = poolLoans[pool];
    }

    /**
     * @dev Fund a loan
     * LoanToken should be created by the LoanFactory over the pool
     * than was also created by the PoolFactory.
     * Method should be called by the loan borrower
     *
     * When called, lender takes funds from the pool, gives it to the loan and holds all LoanTokens
     * Origination fee is transferred to the stake
     *
     * @param loanToken LoanToken to fund
     */
    function fund(ILoanToken2 loanToken) external {
        require(msg.sender == loanToken.borrower(), "TrueLender: Sender is not borrower");
        ITrueFiPool2 pool = loanToken.pool();

        require(factory.isSupportedPool(pool), "TrueLender: Pool not supported by the factory");
        require(loanToken.token() == pool.token(), "TrueLender: Loan and pool token mismatch");
        require(poolLoans[pool].length < maxLoans, "TrueLender: Loans number has reached the limit");
        require(borrowingMutex.isUnlocked(msg.sender), "TrueLender: There is an ongoing loan or credit line");
        require(creditOracle.status(msg.sender) == ITrueFiCreditOracle.Status.Eligible, "TrueLender: Sender is not eligible for loan");

        uint256 term = loanToken.term();
        require(isTermBelowMax(term), "TrueLender: Loan's term is too long");
        require(isCredibleForTerm(term), "TrueLender: Credit score is too low for loan's term");

        uint256 amount = loanToken.amount();
        require(amount <= borrowLimit(pool, loanToken.borrower()), "TrueLender: Loan amount cannot exceed borrow limit");

        poolLoans[pool].push(loanToken);
        pool.borrow(amount);
        pool.token().safeApprove(address(loanToken), amount);
        loanToken.fund();

        borrowingMutex.lock(msg.sender, address(loanToken));

        emit Funded(address(pool), address(loanToken), amount);
    }

    /**
     * @dev Loop through loan tokens for the pool and calculate theoretical value of all loans
     * There should never be too many loans in the pool to run out of gas
     * @param pool pool address
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value(ITrueFiPool2 pool) external override view returns (uint256) {
        ILoanToken2[] storage _loans = poolLoans[pool];
        uint256 totalValue;
        for (uint256 index = 0; index < _loans.length; index++) {
            totalValue = totalValue.add(_loans[index].value(_loans[index].balanceOf(address(this))));
        }
        return totalValue;
    }

    /**
     * @dev For settled loans, redeem LoanTokens for underlying funds
     * @param loanToken Loan to reclaim capital from (must be previously funded)
     */
    function reclaim(ILoanToken2 loanToken, bytes calldata data) external {
        ITrueFiPool2 pool = loanToken.pool();
        IDebtToken.Status status = loanToken.status();
        require(status >= IDebtToken.Status.Settled, "TrueLender: LoanToken is not closed yet");

        if (status != IDebtToken.Status.Settled) {
            require(msg.sender == owner(), "TrueLender: Only owner can reclaim from defaulted loan");
        }

        // find the token, repay loan and remove loan from loan array
        ILoanToken2[] storage _loans = poolLoans[pool];
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loanToken) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();

                uint256 fundsReclaimed = _redeemAndRepay(loanToken, pool, data);
                emit Reclaimed(address(pool), address(loanToken), fundsReclaimed);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        // This prevents invalid loans from being reclaimed
        revert("TrueLender: This loan has not been funded by the lender");
    }

    /**
     * @dev Get total amount borrowed for `borrower` from fixed term loans in USD
     * @param borrower Borrower to get amount borrowed for
     * @param decimals Precision to use when calculating total borrowed
     * @return Total amount borrowed for `borrower` in USD
     */
    function totalBorrowed(address borrower, uint8 decimals) public view returns (uint256) {
        uint256 borrowSum;
        uint256 resultPrecision = uint256(10)**decimals;

        ITrueFiPool2[] memory tvlPools = factory.getSupportedPools();
        for (uint8 i = 0; i < tvlPools.length; i++) {
            ITrueFiPool2 pool = tvlPools[i];
            uint256 poolPrecision = uint256(10)**ITrueFiPool2WithDecimals(address(pool)).decimals();
            ILoanToken2[] memory _loans = poolLoans[pool];
            for (uint8 j = 0; j < _loans.length; j++) {
                ILoanToken2 loan = _loans[j];
                if (address(loan.borrower()) == borrower) {
                    uint256 loanValue = loan.value(loan.balanceOf(address(this)));
                    borrowSum = borrowSum.add(loanValue.mul(resultPrecision).div(poolPrecision));
                }
            }
        }
        return borrowSum;
    }

    /**
     * @dev Get borrow limit for `borrower` in `pool` using rate adjuster
     * @param pool Pool to get borrow limit for
     * @param borrower Borrower to get borrow limit for
     * @return borrow limit for `borrower` in `pool`
     */
    function borrowLimit(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        uint8 poolDecimals = ITrueFiPool2WithDecimals(address(pool)).decimals();
        return
            rateAdjuster.borrowLimit(
                pool,
                creditOracle.score(borrower),
                creditOracle.maxBorrowerLimit(borrower),
                totalBorrowed(borrower, poolDecimals)
            );
    }

    /**
     * @dev Helper function to redeem funds from `loanToken` and repay them into the `pool`
     * @param loanToken Loan to reclaim capital from
     * @param pool Pool from which the loan was funded
     */
    function _redeemAndRepay(
        ILoanToken2 loanToken,
        ITrueFiPool2 pool,
        bytes calldata data
    ) internal returns (uint256) {
        // call redeem function on LoanToken
        uint256 balanceBefore = pool.token().balanceOf(address(this));
        loanToken.redeem(loanToken.balanceOf(address(this)));
        uint256 balanceAfter = pool.token().balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        uint256 fundsReclaimed = balanceAfter.sub(balanceBefore);

        uint256 feeAmount;
        if (address(feeToken) != address(0)) {
            // swap fee for feeToken
            feeAmount = _swapFee(pool, loanToken, data);
        }

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
        ILoanToken2 loanToken,
        bytes calldata data
    ) internal returns (uint256) {
        uint256 feeAmount = loanToken.debt().sub(loanToken.amount()).mul(fee).div(BASIS_RATIO);
        IERC20WithDecimals token = IERC20WithDecimals(address(pool.token()));
        if (token == feeToken) {
            return feeAmount;
        }
        if (feeAmount == 0) {
            return 0;
        }
        (I1Inch3.SwapDescription memory swap, uint256 balanceDiff) = _1inch.exchange(data);
        uint256 expectedDiff = pool.oracle().tokenToUsd(feeAmount).mul(10**feeToken.decimals()).div(1 ether);

        require(swap.srcToken == address(token), "TrueLender: Source token is not same as pool's token");
        require(swap.dstToken == address(feeToken), "TrueLender: Destination token is not fee token");
        require(swap.dstReceiver == address(this), "TrueLender: Receiver is not lender");
        require(swap.amount == feeAmount, "TrueLender: Incorrect fee swap amount");
        require(swap.flags & ONE_INCH_PARTIAL_FILL_FLAG == 0, "TrueLender: Partial fill is not allowed");
        require(
            balanceDiff >= expectedDiff.mul(BASIS_RATIO.sub(swapFeeSlippage)).div(BASIS_RATIO),
            "TrueLender: Fee returned from swap is too small"
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

    /**
     * @dev Withdraw a basket of tokens held by the pool
     * Function is expected to be called by the pool
     * When exiting the pool, the pool contract calls this function
     * to withdraw a fraction of all the loans held by the pool
     * Loop through recipient's share of LoanTokens and calculate versus total per loan.
     * There should never be too many loans in the pool to run out of gas
     *
     * @param recipient Recipient of basket
     * @param numerator Numerator of fraction to withdraw
     * @param denominator Denominator of fraction to withdraw
     */
    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external override onlySupportedPool {
        _distribute(recipient, numerator, denominator, msg.sender);
    }

    /**
     * @dev Allow pool to transfer all LoanTokens to the SAFU in case of liquidation
     * @param loan LoanToken address
     * @param recipient expected to be SAFU address
     */
    function transferAllLoanTokens(ILoanToken2 loan, address recipient) external override onlySupportedPool {
        _transferAllLoanTokens(loan, recipient);
    }

    function _transferAllLoanTokens(ILoanToken2 loan, address recipient) internal {
        // find the token, transfer to SAFU and remove loan from loans list
        ILoanToken2[] storage _loans = poolLoans[loan.pool()];
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loan) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();

                _transferLoan(loan, recipient, 1, 1);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        // This prevents invalid loans from being reclaimed
        revert("TrueLender: This loan has not been funded by the lender");
    }

    /// @dev Helper used in tests
    function _distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) internal {
        ILoanToken2[] storage _loans = poolLoans[ITrueFiPool2(pool)];
        for (uint256 index = 0; index < _loans.length; index++) {
            _transferLoan(_loans[index], recipient, numerator, denominator);
        }
    }

    // @dev Transfer (numerator/denominator)*balance of loan to the recipient
    function _transferLoan(
        ILoanToken2 loan,
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) internal {
        loan.safeTransfer(recipient, numerator.mul(loan.balanceOf(address(this))).div(denominator));
    }

    function isCredibleForTerm(uint256 term) internal view returns (bool) {
        if (term > longTermLoanThreshold) {
            return creditOracle.score(msg.sender) >= longTermLoanScoreThreshold;
        }
        return true;
    }

    function isTermBelowMax(uint256 term) internal view returns (bool) {
        return term <= maxLoanTerm;
    }

    function deprecate() external {
        DEPRECATED__ratingAgency = ITrueRatingAgency(address(0));
        DEPRECATED__minVotes = type(uint256).max;
        DEPRECATED__minRatio = type(uint256).max;
        DEPRECATED__votingPeriod = type(uint256).max;
    }
}
