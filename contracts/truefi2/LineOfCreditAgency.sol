// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {IRateModel} from "./interface/IRateModel.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ILineOfCreditAgency} from "./interface/ILineOfCreditAgency.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {IStakingVault} from "./interface/IStakingVault.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

/**
 * @title LineOfCreditAgency
 * @dev Manager for Lines of Credit in the TrueFi Protocol
 * https://github.com/trusttoken/truefi-spec/blob/master/TrueFi2.0.md#lines-of-credit
 *
 * - Tracks interest rates and cumulative interest owed
 * - Data is grouped by score in "buckets" for scalability
 * - poke() functions used to update state for buckets
 * - Uses RateModel to calculate rates & limits
 * - Responsible for approving borrowing from TrueFi pools using Lines of Credit
 */
contract LineOfCreditAgency is UpgradeableClaimable, ILineOfCreditAgency {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    enum DefaultReason {NotAllowed, Ineligible, BelowMinScore, InterestOverdue, BorrowLimitExceeded}

    /// @dev credit scores are uint8
    uint8 constant MAX_CREDIT_SCORE = 255;

    /// @dev precision used for cumulative interest per share
    uint256 constant ADDITIONAL_PRECISION = 1e27;

    /// @dev basis precision: 10000 = 100%
    uint256 constant BASIS_POINTS = 10000;

    /// @dev total & cumulative interest for borrowers in a bucket
    struct SavedInterest {
        uint256 total;
        uint256 perShare;
    }

    /// @dev borrowers are grouped by score in order to scale more efficiently
    struct CreditScoreBucket {
        // number of borrowers in this bucket
        uint16 borrowersCount;
        // last updated timestamp
        uint128 timestamp;
        // current bucket rate
        uint256 rate;
        // how much interest was gathered by 1 wei times 10^27
        uint256 cumulativeInterestPerShare;
        // total borrowed in this bucket
        uint256 totalBorrowed;
        // save total & cumulative interest per borrower
        mapping(address => SavedInterest) savedInterest;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    /// @dev credit score buckets for each pool
    mapping(ITrueFiPool2 => CreditScoreBucket[256]) public buckets;

    /// @dev score per borrower for each pool
    mapping(ITrueFiPool2 => mapping(address => uint8)) public creditScore;

    /// @dev amount borrowed per borrower for each pool
    mapping(ITrueFiPool2 => mapping(address => uint256)) public borrowed;

    /// @dev total interest paid by borrower for each pool
    mapping(ITrueFiPool2 => mapping(address => uint256)) public borrowerTotalPaidInterest;

    /// @dev total interest paid for each pool
    mapping(ITrueFiPool2 => uint256) public poolTotalPaidInterest;

    /// @dev total interest for each pool
    mapping(ITrueFiPool2 => uint256) public poolTotalInterest;

    /// @dev next payment due time per borrower for each pool
    mapping(ITrueFiPool2 => mapping(address => uint256)) public nextInterestRepayTime;

    mapping(address => bool) private DEPRECATED__isPoolAllowed;

    address[] private DEPRECATED__pools;

    /// @dev whitelist for allowing borrowers to take lines of credit
    mapping(address => bool) public isBorrowerAllowed;

    /// @dev period over which regular interest payments must be made
    uint256 public interestRepaymentPeriod;

    /// @dev rate model
    IRateModel public rateModel;

    /// @dev credit oracle
    ITrueFiCreditOracle public creditOracle;

    // mutex ensuring there's only one running loan or credit line for borrower
    IBorrowingMutex public borrowingMutex;

    /**
     * @dev Buckets Bitmap
     * This bitmap is used to non-empty buckets.
     * If at least one borrower with a score n has an opened credit line, the n-th bit of the bitmap is set
     * Profiling result of calling poke() with one borrower:
     * - 650k gas used without using bitmap
     * - 120k gas used using bitmap
     */
    uint256 public usedBucketsBitmap;

    /// @dev minimum credit score required to use lines of credit
    uint256 public minCreditScore;

    IPoolFactory public poolFactory;

    ILoanFactory2 public loanFactory;

    mapping(ITrueFiPool2 => mapping(address => uint256)) public overBorrowLimitTime;

    IStakingVault public stakingVault;

    // ======= STORAGE DECLARATION END ============

    /// @dev emit `newRateModel` when rate model changed
    event RateModelChanged(IRateModel newRateModel);

    /// @dev emit `newPoolFactory` when pool factory changed
    event PoolFactoryChanged(IPoolFactory newPoolFactory);

    /// @dev emit `newLoanFactory` when loan factory changed
    event LoanFactoryChanged(ILoanFactory2 newLoanFactory);

    /// @dev emit `who` and `isAllowed` when borrower allowance changes
    event BorrowerAllowed(address indexed who, bool isAllowed);

    /// @dev emit `pool` and `isAllowed` when pool allowance changes
    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    /// @dev emit `newPeriod` when interest repayment period changes
    event InterestRepaymentPeriodChanged(uint256 newPeriod);

    /// @dev emit `pool`, `amount` when `borrower` makes an interest payment
    event InterestPaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    /// @dev emit `pool`, `amount` when `borrower` repays principal balance
    event PrincipalRepaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    /// @dev emit `newValue` when minimum credit score is changed
    event MinCreditScoreChanged(uint256 newValue);

    event EnteredDefault(address borrower, DefaultReason reason);

    /// @dev initialize
    function initialize(
        ITrueFiCreditOracle _creditOracle,
        IRateModel _rateModel,
        IBorrowingMutex _borrowingMutex,
        IPoolFactory _poolFactory,
        ILoanFactory2 _loanFactory,
        IStakingVault _stakingVault
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        creditOracle = _creditOracle;
        rateModel = _rateModel;
        borrowingMutex = _borrowingMutex;
        poolFactory = _poolFactory;
        loanFactory = _loanFactory;
        stakingVault = _stakingVault;
        minCreditScore = 191;
        interestRepaymentPeriod = 31 days;
    }

    /// @dev modifier for only whitelisted borrowers
    modifier onlyAllowedBorrowers() {
        require(isBorrowerAllowed[msg.sender], "LineOfCreditAgency: Sender is not allowed to borrow");
        _;
    }

    /// @dev Set rateModel to `newRateModel` and update state
    function setRateModel(IRateModel newRateModel) external onlyOwner {
        require(address(newRateModel) != address(0), "LineOfCreditAgency: RateModel cannot be set to zero address");
        rateModel = newRateModel;
        pokeAll();
        emit RateModelChanged(newRateModel);
    }

    /// @dev Set poolFactory to `newPoolFactory` and update state
    function setPoolFactory(IPoolFactory newPoolFactory) external onlyOwner {
        require(address(newPoolFactory) != address(0), "LineOfCreditAgency: PoolFactory cannot be set to zero address");
        poolFactory = newPoolFactory;
        emit PoolFactoryChanged(newPoolFactory);
    }

    /// @dev Set loanFactory to `newLoanFactory` and update state
    function setLoanFactory(ILoanFactory2 newLoanFactory) external onlyOwner {
        require(address(newLoanFactory) != address(0), "LineOfCreditAgency: LoanFactory cannot be set to zero address");
        loanFactory = newLoanFactory;
        emit LoanFactoryChanged(newLoanFactory);
    }

    /// @dev set interestRepaymentPeriod to `newPeriod`
    function setInterestRepaymentPeriod(uint256 newPeriod) external onlyOwner {
        interestRepaymentPeriod = newPeriod;
        emit InterestRepaymentPeriodChanged(newPeriod);
    }

    /// @dev set minCreditScore to `newValue`
    function setMinCreditScore(uint256 newValue) external onlyOwner {
        minCreditScore = newValue;
        emit MinCreditScoreChanged(newValue);
    }

    /// @dev set borrower `who` to whitelist status `isAllowed`
    function allowBorrower(address who, bool isAllowed) external onlyOwner {
        isBorrowerAllowed[who] = isAllowed;
        emit BorrowerAllowed(who, isAllowed);
    }

    /**
     * @dev Update credit score for `borrower` in `pool` and refresh state
     * Can be called by anyone
     * @param pool Pool to update credit score for
     * @param borrower Borrower to update credit score for
     */
    function updateCreditScore(ITrueFiPool2 pool, address borrower) public {
        (uint8 oldEffectiveScore, uint8 newEffectiveScore) = _updateCreditScore(pool, borrower, borrowed[pool][borrower]);
        if (oldEffectiveScore == newEffectiveScore) {
            return;
        }

        _rebucket(pool, borrower, oldEffectiveScore, newEffectiveScore, borrowed[pool][borrower]);
    }

    /**
     * @dev Internal function to update `borrower` credit score for `pool` using credit oracle
     * @return Tuple containing (oldEffectiveScore, newEffectiveScore)
     */
    function _updateCreditScore(
        ITrueFiPool2 pool,
        address borrower,
        uint256 borrowedAmount
    ) internal returns (uint8, uint8) {
        uint8 oldEffectiveScore = creditScore[pool][borrower];
        uint8 rawScore = creditOracle.score(borrower);
        uint256 stakedAmount = stakingVault.stakedAmount(borrower);
        uint8 newEffectiveScore = rateModel.effectiveScore(rawScore, pool, stakedAmount, borrowedAmount);
        creditScore[pool][borrower] = newEffectiveScore;
        return (oldEffectiveScore, newEffectiveScore);
    }

    /// @dev Get credit score adjustment from rate model
    function creditScoreAdjustmentRate(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        return rateModel.creditScoreAdjustmentRate(creditScore[pool][borrower]);
    }

    /// @dev Get utilization adjustment from rate model
    function utilizationAdjustmentRate(ITrueFiPool2 pool) public view returns (uint256) {
        return rateModel.utilizationAdjustmentRate(pool, 0);
    }

    /// @dev Get pool basic rate from rate model
    function poolBasicRate(ITrueFiPool2 pool) public view returns (uint256) {
        return rateModel.poolBasicRate(pool, 0);
    }

    /// @dev Get borrow limit adjustment from rate model
    function borrowLimitAdjustment(uint8 score) public view returns (uint256) {
        return rateModel.borrowLimitAdjustment(score);
    }

    /**
     * @dev Get total amount borrowed for `borrower` from lines of credit in USD
     * @param borrower Borrower to get amount borrowed for
     * @return borrowSum Total amount borrowed for `borrower` in USD
     */
    function totalBorrowed(address borrower) public view returns (uint256) {
        uint256 borrowSum;
        // loop through pools and sum amount borrowed converted to USD
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        for (uint256 i = 0; i < pools.length; i++) {
            borrowSum = borrowSum.add(pools[i].oracle().tokenToUsd(borrowed[pools[i]][borrower]));
        }
        return borrowSum;
    }

    /**
     * @dev Get borrow limit for `borrower` in `pool` using rate model
     * @param pool Pool to get borrow limit for
     * @param borrower Borrower to get borrow limit for
     * @return borrow limit for `borrower` in `pool`
     */
    function borrowLimit(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        return
            rateModel.borrowLimit(
                pool,
                creditOracle.score(borrower),
                creditOracle.maxBorrowerLimit(borrower),
                stakingVault.stakedAmount(borrower),
                totalBorrowed(borrower)
            );
    }

    function isOverLimit(ITrueFiPool2 pool, address borrower) public view returns (bool) {
        return
            rateModel.isOverLimit(
                pool,
                creditOracle.score(borrower),
                creditOracle.maxBorrowerLimit(borrower),
                stakingVault.stakedAmount(borrower),
                totalBorrowed(borrower)
            );
    }

    /**
     * @dev Returns false iff borrower will stay over borrow limit in all pools when `stakedAmount` is staked
     */
    function isOverProFormaLimit(address borrower, uint256 stakedAmount) external override view returns (bool) {
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        uint256 _totalBorrowed = totalBorrowed(borrower);
        uint8 _score = creditOracle.score(borrower);
        uint256 _maxBorrowerLimit = creditOracle.maxBorrowerLimit(borrower);
        for (uint256 i = 0; i < pools.length; i++) {
            if (
                borrowed[pools[i]][borrower] > 0 &&
                rateModel.isOverLimit(pools[i], _score, _maxBorrowerLimit, stakedAmount, _totalBorrowed)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Get current rate for `borrower` in `pool` from rate model
     * @return current rate for `borrower` in `pool`
     */
    function currentRate(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return rateModel.rate(pool, creditScore[pool][borrower], 0);
    }

    /**
     * @dev Get interest rate for `borrower` in `pool` from storage
     * @return Interest owed for `borrower` in `pool`
     */
    function interest(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        CreditScoreBucket storage bucket = buckets[pool][creditScore[pool][borrower]];
        return _interest(pool, bucket, borrower);
    }

    /**
     * @dev Borrow from `pool` for `amount` using lines of credit
     * Only whitelisted borrowers that meet all requirements can borrow
     * @param pool Pool to borrow from
     * @param amount Amount of tokens to borrow
     */
    function borrow(ITrueFiPool2 pool, uint256 amount) external onlyAllowedBorrowers {
        require(poolFactory.isSupportedPool(pool), "LineOfCreditAgency: The pool is not supported for borrowing");
        require(
            creditOracle.status(msg.sender) == ITrueFiCreditOracle.Status.Eligible,
            "LineOfCreditAgency: Sender not eligible to borrow"
        );
        require(!_hasOverdueInterest(pool, msg.sender), "LineOfCreditAgency: Sender has overdue interest in this pool");
        uint8 rawScore = creditOracle.score(msg.sender);
        require(rawScore >= minCreditScore, "LineOfCreditAgency: Borrower has credit score below minimum");
        require(
            pool.oracle().tokenToUsd(amount) <= borrowLimit(pool, msg.sender),
            "LineOfCreditAgency: Borrow amount cannot exceed borrow limit"
        );
        if (totalBorrowed(msg.sender) == 0) {
            borrowingMutex.lock(msg.sender, address(this));
        }
        require(
            borrowingMutex.locker(msg.sender) == address(this),
            "LineOfCreditAgency: Borrower cannot open two simultaneous debt positions"
        );

        uint256 currentPrincipal = borrowed[pool][msg.sender];
        uint256 newPrincipal = currentPrincipal.add(amount);
        (uint8 oldEffectiveScore, uint8 newEffectiveScore) = _updateCreditScore(pool, msg.sender, newPrincipal);
        if (currentPrincipal == 0) {
            nextInterestRepayTime[pool][msg.sender] = block.timestamp.add(interestRepaymentPeriod);
        }
        overBorrowLimitTime[pool][msg.sender] = 0;
        _rebucket(pool, msg.sender, oldEffectiveScore, newEffectiveScore, newPrincipal);

        pool.borrow(amount);
        pool.token().safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Pay full balance of interest to `pool`
     * Calling this function resets a timer for when interest payments are due
     * Borrowers should call this function at least once per payment period
     * @param pool Pool to pay full balance of interest for
     */
    function payInterest(ITrueFiPool2 pool) external {
        repay(pool, interest(pool, msg.sender));
    }

    /**
     * @dev Function to repay debt in `pool` for `amount`
     * Accrued interest is always repaid first before principal
     * Paying equal to or greater than accrued interest resets next repayment time
     * @param pool Pool to repay principal for
     * @param amount Amount of tokens to repay
     */
    function repay(ITrueFiPool2 pool, uint256 amount) public {
        require(poolFactory.isSupportedPool(pool), "LineOfCreditAgency: The pool is not supported");
        uint256 principal = borrowed[pool][msg.sender];
        uint256 accruedInterest = interest(pool, msg.sender);
        require(principal.add(accruedInterest) >= amount, "LineOfCreditAgency: Cannot repay over the debt");

        // update state before making token transfer
        if (amount < accruedInterest) {
            _payInterestWithoutTransfer(pool, amount);
        } else {
            nextInterestRepayTime[pool][msg.sender] = block.timestamp.add(interestRepaymentPeriod);
            _payInterestWithoutTransfer(pool, accruedInterest);
            _payPrincipalWithoutTransfer(pool, amount.sub(accruedInterest));
        }

        if (borrowed[pool][msg.sender] == 0) {
            nextInterestRepayTime[pool][msg.sender] = 0;
        }
        pokeBorrowLimitTimer(pool, msg.sender);

        // transfer token from sender wallets
        _repay(pool, amount);
        if (totalBorrowed(msg.sender) == 0) {
            borrowingMutex.unlock(msg.sender);
        }
    }

    /**
     * @dev Repay principal and interest for `pool` in a single transaction
     * @param pool Pool to repay full debt in
     */
    function repayInFull(ITrueFiPool2 pool) external {
        repay(pool, interest(pool, msg.sender).add(borrowed[pool][msg.sender]));
    }

    /**
     * @dev Enter default for a certain borrower's line of credit
     */
    function enterDefault(address borrower) external onlyOwner {
        require(
            borrowingMutex.locker(borrower) == address(this),
            "LineOfCreditAgency: Cannot default a borrower with no open debt position"
        );
        if (!isBorrowerAllowed[borrower]) {
            _enterDefault(borrower, DefaultReason.NotAllowed);
            return;
        }
        if (creditOracle.status(borrower) == ITrueFiCreditOracle.Status.Ineligible) {
            _enterDefault(borrower, DefaultReason.Ineligible);
            return;
        }
        if (creditOracle.score(borrower) < minCreditScore) {
            _enterDefault(borrower, DefaultReason.BelowMinScore);
            return;
        }
        uint256 defaultTime = block.timestamp.sub(creditOracle.gracePeriod());
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        for (uint256 i = 0; i < pools.length; i++) {
            ITrueFiPool2 pool = pools[i];
            uint256 nextInterestRepay = nextInterestRepayTime[pool][borrower];
            if (nextInterestRepay != 0 && defaultTime >= nextInterestRepay) {
                _enterDefault(borrower, DefaultReason.InterestOverdue);
                return;
            }
            uint256 _overBorrowLimitTime = overBorrowLimitTime[pool][borrower];
            if (_overBorrowLimitTime != 0 && defaultTime >= _overBorrowLimitTime) {
                _enterDefault(borrower, DefaultReason.BorrowLimitExceeded);
                return;
            }
        }
        revert("LineOfCreditAgency: Borrower has no reason to enter default at this time");
    }

    function _enterDefault(address borrower, DefaultReason reason) private {
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        for (uint256 i = 0; i < pools.length; i++) {
            ITrueFiPool2 pool = pools[i];

            uint256 principal = borrowed[pool][borrower];
            uint256 _interest = interest(pool, borrower);
            uint256 debt = principal.add(_interest);
            if (debt == 0) {
                continue;
            }

            (uint8 oldEffectiveScore, uint8 newEffectiveScore) = _updateCreditScore(pool, borrower, principal);
            _rebucket(pool, borrower, oldEffectiveScore, newEffectiveScore, 0);

            borrowerTotalPaidInterest[pool][borrower] = borrowerTotalPaidInterest[pool][borrower].add(_interest);
            poolTotalPaidInterest[pool] = poolTotalPaidInterest[pool].add(_interest);

            IDebtToken newToken = loanFactory.createDebtToken(pool, borrower, debt);
            newToken.approve(address(pool), debt);
            pool.addDebt(newToken, debt);
        }

        borrowingMutex.ban(borrower);

        emit EnteredDefault(borrower, reason);
    }

    function pokeBorrowLimitTimer(ITrueFiPool2 pool, address borrower) public {
        if (!isOverLimit(pool, borrower)) {
            overBorrowLimitTime[pool][borrower] = 0;
            return;
        }
        if (overBorrowLimitTime[pool][borrower] == 0) {
            overBorrowLimitTime[pool][borrower] = block.timestamp;
        }
    }

    /**
     * @dev Update state for a pool
     * @param pool Pool to update state for
     */
    function poke(ITrueFiPool2 pool) public {
        require(poolFactory.isSupportedPool(pool), "LineOfCreditAgency: The pool is not supported for poking");
        uint256 bitMap = usedBucketsBitmap;
        uint256 timeNow = block.timestamp;
        // get basic pool rate
        uint256 poolRate = poolBasicRate(pool);

        // loop through scores and poke buckets, ignoring empty buckets
        for (uint256 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            _pokeSingleBucket(pool, uint8(i), timeNow, poolRate);
        }
    }

    /**
     * @dev Update state for all pools
     */
    function pokeAll() public {
        // loop through pools array and poke
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        for (uint256 i = 0; i < pools.length; i++) {
            poke(pools[i]);
        }
    }

    /**
     * @dev Update credit scores for all pools
     */
    function updateAllCreditScores(address borrower) external override {
        ITrueFiPool2[] memory pools = poolFactory.getSupportedPools();
        for (uint256 i = 0; i < pools.length; i++) {
            updateCreditScore(pools[i], borrower);
        }
    }

    /// @dev Internal function to update state for `bucketNumber` in `pool`
    function pokeSingleBucket(ITrueFiPool2 pool, uint8 bucketNumber) internal {
        uint256 timeNow = block.timestamp;
        uint256 poolRate = poolBasicRate(pool);

        _pokeSingleBucket(pool, bucketNumber, timeNow, poolRate);
    }

    /**
     * @dev Internal function to update state for a single bucket
     * @param pool Pool to update bucket for
     * @param bucketNumber Bucket to update
     * @param timeNow Current time
     * @param poolRate Pool base rate
     */
    function _pokeSingleBucket(
        ITrueFiPool2 pool,
        uint8 bucketNumber,
        uint256 timeNow,
        uint256 poolRate
    ) internal {
        CreditScoreBucket storage bucket = buckets[pool][bucketNumber];

        uint256 newInterestPerShare = _newInterestPerShare(bucket, timeNow);
        poolTotalInterest[pool] = poolTotalInterest[pool].add(bucket.totalBorrowed.mul(newInterestPerShare));
        bucket.cumulativeInterestPerShare = bucket.cumulativeInterestPerShare.add(newInterestPerShare);

        bucket.rate = rateModel.combinedRate(poolRate, rateModel.creditScoreAdjustmentRate(bucketNumber));
        bucket.timestamp = uint128(timeNow);
    }

    /// @dev Calculate new interest per share for `bucket` at `timeNow`
    function _newInterestPerShare(CreditScoreBucket storage bucket, uint256 timeNow) private view returns (uint256) {
        return bucket.rate.mul(timeNow.sub(bucket.timestamp)).mul(ADDITIONAL_PRECISION / BASIS_POINTS).div(365 days);
    }

    /**
     * @dev Calculate USD value for credit lines in pool
     * @param pool Pool to get USD value for
     * @return USD value of credit lines for pool
     */
    function poolCreditValue(ITrueFiPool2 pool) external override view returns (uint256) {
        uint256 bitMap = usedBucketsBitmap;
        CreditScoreBucket[256] storage creditScoreBuckets = buckets[pool];
        uint256 timeNow = block.timestamp;
        uint256 bucketSum;

        // loop through buckets and sum total borrowed ignoring empty buckets
        for (uint256 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            CreditScoreBucket storage bucket = creditScoreBuckets[i];

            bucketSum = bucketSum.add(bucket.totalBorrowed.mul(ADDITIONAL_PRECISION));
            bucketSum = bucketSum.add(bucket.totalBorrowed.mul(_newInterestPerShare(bucket, timeNow)));
        }
        return (poolTotalInterest[pool].add(bucketSum).div(ADDITIONAL_PRECISION)).sub(poolTotalPaidInterest[pool]);
    }

    /**
     * @dev Get value of a single line of credit for `borrower` in `pool`
     * @return Value of a borrower's line of credit in a pool
     */
    function singleCreditValue(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return borrowed[pool][borrower].add(interest(pool, borrower));
    }

    /**
     * @dev Internal function to check if a borrower has overdue interest
     * @return Returns true if a borrower is overdue
     */
    function _hasOverdueInterest(ITrueFiPool2 pool, address borrower) private view returns (bool) {
        return borrowed[pool][borrower] > 0 && block.timestamp >= nextInterestRepayTime[pool][borrower];
    }

    /**
     * @dev Move borrower from one bucket to another when borrower score changes
     * @param pool Pool to rebucket in
     * @param borrower Borrower to move to a new bucket
     * @param oldEffectiveScore Old credit score
     * @param newEffectiveScore New credit score
     * @param updatedBorrowAmount New borrower amount
     */
    function _rebucket(
        ITrueFiPool2 pool,
        address borrower,
        uint8 oldEffectiveScore,
        uint8 newEffectiveScore,
        uint256 updatedBorrowAmount
    ) internal {
        // take out of old bucket
        uint256 totalBorrowerInterest = oldEffectiveScore > 0
            ? _takeOutOfBucket(pool, buckets[pool][oldEffectiveScore], oldEffectiveScore, borrower)
            : 0;
        // update borrow amount
        borrowed[pool][borrower] = updatedBorrowAmount;
        CreditScoreBucket storage bucket = buckets[pool][newEffectiveScore];
        // put into new bucket
        _putIntoBucket(pool, bucket, newEffectiveScore, borrower);
        // save interest
        bucket.savedInterest[borrower] = SavedInterest(totalBorrowerInterest, bucket.cumulativeInterestPerShare);
    }

    /**
     * @dev Internal function to take `borrower` out of a bucket
     * @param pool Pool to remove borrower from
     * @param bucket Bucket data
     * @param bucketNumber Bucket number based on credit score
     * @param borrower Borrower to take out of bucket
     * @return totalBorrowerInterest Total borrower interest for this pool
     */
    function _takeOutOfBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal returns (uint256 totalBorrowerInterest) {
        require(bucket.borrowersCount > 0, "LineOfCreditAgency: bucket is empty");
        // update bucket state
        pokeSingleBucket(pool, bucketNumber);
        // decrement count for this bucket
        bucket.borrowersCount -= 1;
        // clear bucket bitmap if bucket is empty
        if (bucket.borrowersCount == 0) {
            usedBucketsBitmap &= ~(uint256(1) << bucketNumber);
        }
        // adjust total borrow & interest for bucket and delete in storage
        bucket.totalBorrowed = bucket.totalBorrowed.sub(borrowed[pool][borrower]);
        totalBorrowerInterest = _totalBorrowerInterest(pool, bucket, borrower);
        delete bucket.savedInterest[borrower];
    }

    /**
     * @dev Internal function to put borrower into a bucket
     * @param pool Pool to add borrower to
     * @param bucket Bucket data
     * @param bucketNumber Bucket number based on credit score
     * @param borrower Borrower to put into bucket
     */
    function _putIntoBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal {
        // update  bucket state
        pokeSingleBucket(pool, bucketNumber);
        // increment count for this bucket
        bucket.borrowersCount = _add16(bucket.borrowersCount, 1);
        // add to bitmap if first time in this bucket
        if (bucket.borrowersCount == 1) {
            usedBucketsBitmap |= uint256(1) << bucketNumber;
        }
        // adjust total borrow in bucket
        bucket.totalBorrowed = bucket.totalBorrowed.add(borrowed[pool][borrower]);
    }

    function _add16(uint16 a, uint16 b) private pure returns (uint16) {
        uint16 c = a + b;
        require(c >= a, "LineOfCreditAgency: addition overflow");
        return c;
    }

    /**
     * @dev Internal helper to calculate total borrower interest in a pool based on bucket share
     * @param pool Pool to calculate interest for
     * @param bucket Bucket data
     * @param borrower Borrower to get total interest for
     * @return Borrower total interest for a pool
     */
    function _totalBorrowerInterest(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        address borrower
    ) internal view returns (uint256) {
        uint256 interestPerShare = bucket.cumulativeInterestPerShare.sub(bucket.savedInterest[borrower].perShare).add(
            _newInterestPerShare(bucket, block.timestamp)
        );
        return bucket.savedInterest[borrower].total.add(borrowed[pool][borrower].mul(interestPerShare).div(ADDITIONAL_PRECISION));
    }

    /**
     * @dev Internal function to calculate interest for a single pool
     * @param pool Pool to calculate interest for
     * @param bucket Bucket data
     * @param borrower Borrower to get total interest for
     * @return `borrower` interest in `pool`
     */
    function _interest(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        address borrower
    ) internal view returns (uint256) {
        return _totalBorrowerInterest(pool, bucket, borrower).sub(borrowerTotalPaidInterest[pool][borrower]);
    }

    /**
     * @dev Internal function to change state when msg.sender pays interest
     * Used before transfer to satisfy check-effects interactions
     * @param pool Pool to pay interest in for msg.sender
     * @param amount Amount of interest to pay for msg.sender
     */
    function _payInterestWithoutTransfer(ITrueFiPool2 pool, uint256 amount) internal {
        borrowerTotalPaidInterest[pool][msg.sender] = borrowerTotalPaidInterest[pool][msg.sender].add(amount);
        poolTotalPaidInterest[pool] = poolTotalPaidInterest[pool].add(amount);
        emit InterestPaid(pool, msg.sender, amount);
    }

    /**
     * @dev Internal function to change state when msg.sender pays principal
     * Used before transfer to satisfy check-effects interactions
     * @param pool Pool to pay principal in for msg.sender
     * @param amount Amount of principal to pay for msg.sender
     */
    function _payPrincipalWithoutTransfer(ITrueFiPool2 pool, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        uint256 newPrincipal = borrowed[pool][msg.sender].sub(amount);
        (uint8 oldEffectiveScore, uint8 newEffectiveScore) = _updateCreditScore(pool, msg.sender, newPrincipal);
        _rebucket(pool, msg.sender, oldEffectiveScore, newEffectiveScore, newPrincipal);

        emit PrincipalRepaid(pool, msg.sender, amount);
    }

    /**
     * @dev Internal function used to approve and transfer tokens from agency to pool
     * Called after "payWithoutTransfer" functions to satisfy check-effects interactions
     * @param pool Pool to transfer tokens to
     * @param amount Amount of tokens to transfer
     */
    function _repay(ITrueFiPool2 pool, uint256 amount) internal {
        pool.token().safeTransferFrom(msg.sender, address(this), amount);
        pool.token().safeApprove(address(pool), amount);
        pool.repay(amount);
    }
}
