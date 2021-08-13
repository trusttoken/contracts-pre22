// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20, SafeMath} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueCreditAgency} from "./interface/ITrueCreditAgency.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {ITimeAveragedBaseRateOracle} from "./interface/ITimeAveragedBaseRateOracle.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

contract TrueCreditAgency is UpgradeableClaimable, ITrueCreditAgency {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    uint8 constant MAX_CREDIT_SCORE = 255;
    uint256 constant ADDITIONAL_PRECISION = 1e27;

    struct SavedInterest {
        uint256 total;
        uint256 perShare;
    }

    struct CreditScoreBucket {
        uint16 borrowersCount;
        uint128 timestamp;
        uint256 rate;
        uint256 cumulativeInterestPerShare; // How much interest was gathered by 1 wei times 10^27
        uint256 totalBorrowed;
        mapping(address => SavedInterest) savedInterest;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => CreditScoreBucket[256]) public buckets;

    mapping(ITrueFiPool2 => mapping(address => uint8)) public creditScore;
    mapping(ITrueFiPool2 => mapping(address => uint256)) public borrowed;
    mapping(ITrueFiPool2 => mapping(address => uint256)) public borrowerTotalPaidInterest;
    mapping(ITrueFiPool2 => uint256) public poolTotalPaidInterest;
    mapping(ITrueFiPool2 => uint256) public poolTotalInterest;
    mapping(ITrueFiPool2 => mapping(address => uint256)) public nextInterestRepayTime;

    mapping(ITrueFiPool2 => bool) public isPoolAllowed;
    ITrueFiPool2[] public pools;

    mapping(address => bool) public isBorrowerAllowed;

    uint256 public interestRepaymentPeriod;

    ITrueRateAdjuster public rateAdjuster;

    ITrueFiCreditOracle public creditOracle;

    /**
     * This bitmap is used to non-empty buckets.
     * If at least one borrower with a score n has an opened credit line, the n-th bit of the bitmap is set
     * Profiling result of calling poke() with one borrower:
     * - 650k gas used without using bitmap
     * - 120k gas used using bitmap
     */
    uint256 public usedBucketsBitmap;

    uint256 public minCreditScore;

    // ======= STORAGE DECLARATION END ============

    event BaseRateOracleChanged(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle oracle);

    event TrueRateAdjusterChanged(ITrueRateAdjuster newRateAdjuster);

    event BorrowerAllowed(address indexed who, bool isAllowed);

    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    event InterestRepaymentPeriodChanged(uint256 newPeriod);

    event InterestPaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    event PrincipalRepaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    event MinCreditScoreChanged(uint256 newValue);

    function initialize(ITrueFiCreditOracle _creditOracle, ITrueRateAdjuster _rateAdjuster) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        creditOracle = _creditOracle;
        rateAdjuster = _rateAdjuster;
        interestRepaymentPeriod = 31 days;
    }

    modifier onlyAllowedBorrowers() {
        require(isBorrowerAllowed[msg.sender], "TrueCreditAgency: Sender is not allowed to borrow");
        _;
    }

    function setRateAdjuster(ITrueRateAdjuster newRateAdjuster) external onlyOwner {
        rateAdjuster = newRateAdjuster;
        pokeAll();
        emit TrueRateAdjusterChanged(newRateAdjuster);
    }

    function setInterestRepaymentPeriod(uint256 newPeriod) external onlyOwner {
        interestRepaymentPeriod = newPeriod;
        emit InterestRepaymentPeriodChanged(newPeriod);
    }

    function setMinCreditScore(uint256 newValue) external onlyOwner {
        minCreditScore = newValue;
        emit MinCreditScoreChanged(newValue);
    }

    function allowBorrower(address who, bool isAllowed) external onlyOwner {
        isBorrowerAllowed[who] = isAllowed;
        emit BorrowerAllowed(who, isAllowed);
    }

    function allowPool(ITrueFiPool2 pool, bool isAllowed) external onlyOwner {
        if (!isPoolAllowed[pool] && isAllowed) {
            pools.push(pool);
        }
        if (isPoolAllowed[pool] && !isAllowed) {
            for (uint256 i = 0; i < pools.length; i++) {
                if (pools[i] == pool) {
                    pools[i] = pools[pools.length - 1];
                    pools.pop();
                    break;
                }
            }
        }
        isPoolAllowed[pool] = isAllowed;
        emit PoolAllowed(pool, isAllowed);
    }

    function updateCreditScore(ITrueFiPool2 pool, address borrower) external {
        (uint8 oldScore, uint8 newScore) = _updateCreditScore(pool, borrower);
        if (oldScore == newScore) {
            return;
        }

        _rebucket(pool, borrower, oldScore, newScore, borrowed[pool][borrower]);
    }

    function _updateCreditScore(ITrueFiPool2 pool, address borrower) internal returns (uint8, uint8) {
        uint8 oldScore = creditScore[pool][borrower];
        uint8 newScore = creditOracle.score(borrower);
        creditScore[pool][borrower] = newScore;
        return (oldScore, newScore);
    }

    function creditScoreAdjustmentRate(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        return rateAdjuster.creditScoreAdjustmentRate(creditScore[pool][borrower]);
    }

    function utilizationAdjustmentRate(ITrueFiPool2 pool) public view returns (uint256) {
        return rateAdjuster.utilizationAdjustmentRate(pool);
    }

    function borrowLimitAdjustment(uint8 score) public view returns (uint256) {
        return rateAdjuster.borrowLimitAdjustment(score);
    }

    function totalTVL(uint8 decimals) public view returns (uint256) {
        uint256 tvl = 0;
        uint256 resultPrecision = uint256(10)**decimals;
        for (uint8 i = 0; i < pools.length; i++) {
            tvl = tvl.add(
                pools[i].poolValue().mul(resultPrecision).div(uint256(10)**(ITrueFiPool2WithDecimals(address(pools[i])).decimals()))
            );
        }
        return tvl;
    }

    function totalBorrowed(address borrower, uint8 decimals) public view returns (uint256) {
        uint256 borrowSum = 0;
        uint256 resultPrecision = uint256(10)**decimals;
        for (uint8 i = 0; i < pools.length; i++) {
            borrowSum = borrowSum.add(
                borrowed[pools[i]][borrower].mul(resultPrecision).div(
                    uint256(10)**(ITrueFiPool2WithDecimals(address(pools[i])).decimals())
                )
            );
        }
        return borrowSum;
    }

    function borrowLimit(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        uint8 poolDecimals = ITrueFiPool2WithDecimals(address(pool)).decimals();
        return
            rateAdjuster.borrowLimit(
                pool,
                creditOracle.score(borrower),
                creditOracle.maxBorrowerLimit(borrower),
                totalTVL(poolDecimals),
                totalBorrowed(borrower, poolDecimals)
            );
    }

    function currentRate(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return rateAdjuster.rate(pool, creditScore[pool][borrower]);
    }

    function interest(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        CreditScoreBucket storage bucket = buckets[pool][creditScore[pool][borrower]];
        return _interest(pool, bucket, borrower);
    }

    function borrow(ITrueFiPool2 pool, uint256 amount) external onlyAllowedBorrowers {
        require(isPoolAllowed[pool], "TrueCreditAgency: The pool is not whitelisted for borrowing");
        require(
            creditOracle.status(msg.sender) == ITrueFiCreditOracle.Status.Eligible,
            "TrueCreditAgency: Sender not eligible to borrow"
        );
        require(!_hasOverdueInterest(pool, msg.sender), "TrueCreditAgency: Sender has overdue interest in this pool");
        (uint8 oldScore, uint8 newScore) = _updateCreditScore(pool, msg.sender);
        require(newScore >= minCreditScore, "TrueCreditAgency: Borrower has credit score below minimum");
        require(amount <= borrowLimit(pool, msg.sender), "TrueCreditAgency: Borrow amount cannot exceed borrow limit");
        uint256 currentDebt = borrowed[pool][msg.sender];

        if (currentDebt == 0) {
            nextInterestRepayTime[pool][msg.sender] = block.timestamp.add(interestRepaymentPeriod);
        }

        _rebucket(pool, msg.sender, oldScore, newScore, currentDebt.add(amount));

        pool.borrow(amount);
        pool.token().safeTransfer(msg.sender, amount);
    }

    function payInterest(ITrueFiPool2 pool) external {
        repay(pool, interest(pool, msg.sender));
    }

    function repay(ITrueFiPool2 pool, uint256 amount) public {
        uint256 currentDebt = borrowed[pool][msg.sender];
        uint256 accruedInterest = interest(pool, msg.sender);
        require(currentDebt.add(accruedInterest) >= amount, "TrueCreditAgency: Cannot repay over the debt");

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
        _repay(pool, amount);
    }

    function repayInFull(ITrueFiPool2 pool) external {
        repay(pool, interest(pool, msg.sender).add(borrowed[pool][msg.sender]));
    }

    function poke(ITrueFiPool2 pool) public {
        uint256 bitMap = usedBucketsBitmap;
        uint256 timeNow = block.timestamp;
        uint256 poolRate = rateAdjuster.poolBasicRate(pool);

        for (uint16 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            _pokeSingleBucket(pool, uint8(i), timeNow, poolRate);
        }
    }

    function pokeAll() public {
        for (uint256 i = 0; i < pools.length; i++) {
            poke(pools[i]);
        }
    }

    function pokeSingleBucket(ITrueFiPool2 pool, uint8 bucketNumber) internal {
        uint256 timeNow = block.timestamp;
        uint256 poolRate = rateAdjuster.poolBasicRate(pool);

        _pokeSingleBucket(pool, bucketNumber, timeNow, poolRate);
    }

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

        bucket.rate = rateAdjuster.combinedRate(poolRate, rateAdjuster.creditScoreAdjustmentRate(bucketNumber));
        bucket.timestamp = uint128(timeNow);
    }

    function _newInterestPerShare(CreditScoreBucket storage bucket, uint256 timeNow) private view returns (uint256) {
        return bucket.rate.mul(timeNow.sub(bucket.timestamp)).mul(ADDITIONAL_PRECISION / 10_000).div(365 days);
    }

    function poolCreditValue(ITrueFiPool2 pool) external override view returns (uint256) {
        uint256 bitMap = usedBucketsBitmap;
        CreditScoreBucket[256] storage creditScoreBuckets = buckets[pool];
        uint256 timeNow = block.timestamp;
        uint256 bucketSum = 0;
        for (uint16 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            CreditScoreBucket storage bucket = creditScoreBuckets[i];

            bucketSum = bucketSum.add(bucket.totalBorrowed.mul(ADDITIONAL_PRECISION));
            bucketSum = bucketSum.add(bucket.totalBorrowed.mul(_newInterestPerShare(bucket, timeNow)));
        }
        return (poolTotalInterest[pool].add(bucketSum).div(ADDITIONAL_PRECISION)).sub(poolTotalPaidInterest[pool]);
    }

    function singleCreditValue(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return borrowed[pool][borrower].add(interest(pool, borrower));
    }

    function _hasOverdueInterest(ITrueFiPool2 pool, address borrower) private view returns (bool) {
        return borrowed[pool][borrower] > 0 && block.timestamp >= nextInterestRepayTime[pool][borrower];
    }

    function _rebucket(
        ITrueFiPool2 pool,
        address borrower,
        uint8 oldScore,
        uint8 newScore,
        uint256 updatedBorrowAmount
    ) internal {
        uint256 totalBorrowerInterest = oldScore > 0 ? _takeOutOfBucket(pool, buckets[pool][oldScore], oldScore, borrower) : 0;
        borrowed[pool][borrower] = updatedBorrowAmount;
        CreditScoreBucket storage bucket = buckets[pool][newScore];
        _putIntoBucket(pool, bucket, newScore, borrower);
        bucket.savedInterest[borrower] = SavedInterest(totalBorrowerInterest, bucket.cumulativeInterestPerShare);
    }

    function _takeOutOfBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal returns (uint256 totalBorrowerInterest) {
        require(bucket.borrowersCount > 0, "TrueCreditAgency: bucket is empty");
        pokeSingleBucket(pool, bucketNumber);
        bucket.borrowersCount -= 1;
        if (bucket.borrowersCount == 0) {
            usedBucketsBitmap &= ~(uint256(1) << bucketNumber);
        }
        bucket.totalBorrowed = bucket.totalBorrowed.sub(borrowed[pool][borrower]);
        totalBorrowerInterest = _totalBorrowerInterest(pool, bucket, borrower);
        delete bucket.savedInterest[borrower];
    }

    function _putIntoBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal {
        pokeSingleBucket(pool, bucketNumber);
        bucket.borrowersCount = bucket.borrowersCount + 1;
        if (bucket.borrowersCount == 1) {
            usedBucketsBitmap |= uint256(1) << bucketNumber;
        }
        bucket.totalBorrowed = bucket.totalBorrowed.add(borrowed[pool][borrower]);
    }

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

    function _interest(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        address borrower
    ) internal view returns (uint256) {
        return _totalBorrowerInterest(pool, bucket, borrower).sub(borrowerTotalPaidInterest[pool][borrower]);
    }

    function _payInterestWithoutTransfer(ITrueFiPool2 pool, uint256 amount) internal {
        borrowerTotalPaidInterest[pool][msg.sender] = borrowerTotalPaidInterest[pool][msg.sender].add(amount);
        poolTotalPaidInterest[pool] = poolTotalPaidInterest[pool].add(amount);
        emit InterestPaid(pool, msg.sender, amount);
    }

    function _payPrincipalWithoutTransfer(ITrueFiPool2 pool, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (uint8 oldScore, uint8 newScore) = _updateCreditScore(pool, msg.sender);
        _rebucket(pool, msg.sender, oldScore, newScore, borrowed[pool][msg.sender].sub(amount));

        emit PrincipalRepaid(pool, msg.sender, amount);
    }

    function _repay(ITrueFiPool2 pool, uint256 amount) internal {
        pool.token().safeTransferFrom(msg.sender, address(this), amount);
        pool.token().safeApprove(address(pool), amount);
        pool.repay(amount);
    }
}
