// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20, SafeMath} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueCreditAgency} from "./interface/ITrueCreditAgency.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {ITimeAveragedBaseRateOracle} from "./interface/ITimeAveragedBaseRateOracle.sol";
import {TrueFiFixed64x64} from "./libraries/TrueFiFixed64x64.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

contract TrueCreditAgency is UpgradeableClaimable, ITrueCreditAgency {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using TrueFiFixed64x64 for int128;
    using TrueFiFixed64x64 for uint256;

    enum Status {Ineligible, OnHold, Eligible}

    uint8 constant MAX_CREDIT_SCORE = 255;
    uint256 constant MAX_RATE_CAP = 50000;
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

    struct BorrowLimitConfig {
        uint8 scoreFloor;
        uint16 limitAdjustmentPower; // times 10000
        uint16 tvlLimitCoefficient; // times 10000
        uint16 poolValueLimitCoefficient; // times 10000
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

    mapping(address => uint256) public borrowerAllowedUntilTime;

    uint256 public interestRepaymentPeriod;

    uint256 public gracePeriod;

    // basis precision: 10000 = 100%
    uint256 public riskPremium;

    // basis precision: 10000 = 100%
    uint256 public creditAdjustmentCoefficient;

    BorrowLimitConfig public borrowLimitConfig;

    ITrueFiCreditOracle public creditOracle;

    mapping(ITrueFiPool2 => ITimeAveragedBaseRateOracle) public baseRateOracle;

    /**
     * This bitmap is used to non-empty buckets.
     * If at least one borrower with a score n has an opened credit line, the n-th bit of the bitmap is set
     * Profiling result of calling poke() with one borrower:
     * - 650k gas used without using bitmap
     * - 120k gas used using bitmap
     */
    uint256 public usedBucketsBitmap;

    // basis precision: 10000 = 100%
    uint256 public utilizationAdjustmentCoefficient;

    uint256 public utilizationAdjustmentPower;

    uint256 public minCreditScore;

    // @dev How frequently a score needs to be updated for an account to borrow
    uint256 public creditScoreUpdateThreshold;

    // ======= STORAGE DECLARATION END ============

    event BaseRateOracleChanged(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle oracle);

    event RiskPremiumChanged(uint256 newRate);

    event CreditAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentPowerChanged(uint256 newValue);

    event BorrowerAllowed(address indexed who, uint256 timePeriod);

    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    event InterestRepaymentPeriodChanged(uint256 newPeriod);

    event GracePeriodChanged(uint256 newGracePeriod);

    event InterestPaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    event PrincipalRepaid(ITrueFiPool2 pool, address borrower, uint256 amount);

    event MinCreditScoreChanged(uint256 newValue);

    event CreditScoreUpdateThresholdChanged(uint256 newThreshold);

    event BorrowLimitConfigChanged(
        uint8 scoreFloor,
        uint16 limitAdjustmentPower,
        uint16 tvlLimitCoefficient,
        uint16 poolValueLimitCoefficient
    );

    function initialize(ITrueFiCreditOracle _creditOracle, uint256 _riskPremium) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        creditOracle = _creditOracle;
        riskPremium = _riskPremium;
        creditAdjustmentCoefficient = 1000;
        borrowLimitConfig = BorrowLimitConfig(40, 7500, 1500, 1500);
        utilizationAdjustmentCoefficient = 50;
        utilizationAdjustmentPower = 2;
        interestRepaymentPeriod = 31 days;
        gracePeriod = 3 days;
        creditScoreUpdateThreshold = 30 days;
    }

    modifier onlyAllowedBorrowers() {
        require(borrowerAllowedUntilTime[msg.sender] >= block.timestamp, "TrueCreditAgency: Sender is not allowed to borrow");
        _;
    }

    function setBaseRateOracle(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle _baseRateOracle) external onlyOwner {
        baseRateOracle[pool] = _baseRateOracle;
        emit BaseRateOracleChanged(pool, _baseRateOracle);
    }

    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        for (uint256 i = 0; i < pools.length; i++) {
            poke(pools[i]);
        }
        emit RiskPremiumChanged(newRate);
    }

    function setInterestRepaymentPeriod(uint256 newPeriod) external onlyOwner {
        interestRepaymentPeriod = newPeriod;
        emit InterestRepaymentPeriodChanged(newPeriod);
    }

    function setGracePeriod(uint256 newGracePeriod) external onlyOwner {
        gracePeriod = newGracePeriod;
        emit GracePeriodChanged(newGracePeriod);
    }

    function setBorrowLimitConfig(
        uint8 scoreFloor,
        uint16 limitAdjustmentPower,
        uint16 tvlLimitCoefficient,
        uint16 poolValueLimitCoefficient
    ) external onlyOwner {
        borrowLimitConfig = BorrowLimitConfig(scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient);
        emit BorrowLimitConfigChanged(scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient);
    }

    function setCreditAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        creditAdjustmentCoefficient = newCoefficient;
        emit CreditAdjustmentCoefficientChanged(newCoefficient);
    }

    function setUtilizationAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        utilizationAdjustmentCoefficient = newCoefficient;
        emit UtilizationAdjustmentCoefficientChanged(newCoefficient);
    }

    function setUtilizationAdjustmentPower(uint256 newValue) external onlyOwner {
        utilizationAdjustmentPower = newValue;
        emit UtilizationAdjustmentPowerChanged(newValue);
    }

    function setMinCreditScore(uint256 newValue) external onlyOwner {
        minCreditScore = newValue;
        emit MinCreditScoreChanged(newValue);
    }

    /**
     * @dev Set new threshold for updating credit scores
     */
    function setCreditScoreUpdateThreshold(uint256 newThreshold) public onlyOwner {
        creditScoreUpdateThreshold = newThreshold;
        emit CreditScoreUpdateThresholdChanged(newThreshold);
    }

    function allowBorrower(address who, uint256 timePeriod) external onlyOwner {
        borrowerAllowedUntilTime[who] = block.timestamp.add(timePeriod);
        emit BorrowerAllowed(who, timePeriod);
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
        uint8 newScore = creditOracle.getScore(borrower);
        creditScore[pool][borrower] = newScore;
        return (oldScore, newScore);
    }

    function creditScoreAdjustmentRate(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        return _creditScoreAdjustmentRate(creditScore[pool][borrower]);
    }

    function _creditScoreAdjustmentRate(uint8 score) internal view returns (uint256) {
        if (score == 0) {
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        return min(creditAdjustmentCoefficient.mul(MAX_CREDIT_SCORE - score).div(score), MAX_RATE_CAP);
    }

    function utilizationAdjustmentRate(ITrueFiPool2 pool) public view returns (uint256) {
        uint256 liquidRatio = pool.liquidRatio();
        if (liquidRatio == 0) {
            // if utilization is at 100 %
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        return
            min(
                utilizationAdjustmentCoefficient.mul(1e4**utilizationAdjustmentPower).div(liquidRatio**utilizationAdjustmentPower).sub(
                    utilizationAdjustmentCoefficient
                ),
                MAX_RATE_CAP
            );
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

    function borrowLimitAdjustment(uint256 score) public view returns (uint256) {
        return
            ((score.fromUInt() / MAX_CREDIT_SCORE).fixed64x64Pow(uint256(borrowLimitConfig.limitAdjustmentPower).fromUInt() / 10000) *
                10000)
                .toUInt();
    }

    function borrowLimit(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        uint256 score = uint256(creditOracle.getScore(borrower));
        if (score < borrowLimitConfig.scoreFloor) {
            return 0;
        }
        uint8 poolDecimals = ITrueFiPool2WithDecimals(address(pool)).decimals();
        uint256 maxBorrowerLimit = creditOracle.getMaxBorrowerLimit(borrower).mul(uint256(10)**poolDecimals).div(1 ether);
        uint256 maxTVLLimit = totalTVL(poolDecimals).mul(borrowLimitConfig.tvlLimitCoefficient).div(10000);
        uint256 adjustment = borrowLimitAdjustment(score);
        uint256 creditLimit = min(maxBorrowerLimit, maxTVLLimit).mul(adjustment).div(10000);
        uint256 poolBorrowMax = min(pool.poolValue().mul(borrowLimitConfig.poolValueLimitCoefficient).div(10000), creditLimit);
        return saturatingSub(poolBorrowMax, totalBorrowed(borrower, poolDecimals));
    }

    function currentRate(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return
            _currentRate(
                securedRate(pool).add(riskPremium).add(utilizationAdjustmentRate(pool)),
                creditScoreAdjustmentRate(pool, borrower)
            );
    }

    function securedRate(ITrueFiPool2 pool) public view returns (uint256) {
        return baseRateOracle[pool].getWeeklyAPY();
    }

    /**
     * @dev Helper function used by poke() to save gas by calculating partial terms of the total rate
     * @param bucketRate risk premium + utilization adjustment rate + secured rate
     * @param __creditScoreAdjustmentRate credit score adjustment
     * @return sum of addends capped by MAX_RATE_CAP
     */
    function _currentRate(uint256 bucketRate, uint256 __creditScoreAdjustmentRate) internal pure returns (uint256) {
        return min(bucketRate.add(__creditScoreAdjustmentRate), MAX_RATE_CAP);
    }

    function interest(ITrueFiPool2 pool, address borrower) public view returns (uint256) {
        CreditScoreBucket storage bucket = buckets[pool][creditScore[pool][borrower]];
        return _interest(pool, bucket, borrower);
    }

    function borrow(ITrueFiPool2 pool, uint256 amount) external onlyAllowedBorrowers {
        require(isPoolAllowed[pool], "TrueCreditAgency: The pool is not whitelisted for borrowing");
        require(status(pool, msg.sender) == Status.Eligible, "TrueCreditAgency: Sender not eligible to borrow");
        require(meetsTimeRequirement(msg.sender), "TrueCreditAgency: Borrower credit score does not meet time requirement");
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
        uint256 bucketRate = securedRate(pool).add(riskPremium).add(utilizationAdjustmentRate(pool));

        for (uint16 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            _pokeSingleBucket(pool, uint8(i), timeNow, bucketRate);
        }
    }

    function pokeSingleBucket(ITrueFiPool2 pool, uint8 bucketNumber) internal {
        uint256 timeNow = block.timestamp;
        uint256 bucketRate = securedRate(pool).add(riskPremium).add(utilizationAdjustmentRate(pool));

        _pokeSingleBucket(pool, bucketNumber, timeNow, bucketRate);
    }

    function _pokeSingleBucket(
        ITrueFiPool2 pool,
        uint8 bucketNumber,
        uint256 timeNow,
        uint256 bucketRate
    ) internal {
        CreditScoreBucket storage bucket = buckets[pool][bucketNumber];

        poolTotalInterest[pool] = poolTotalInterest[pool].add(
            bucket.rate.mul(1e23).mul(bucket.totalBorrowed).mul(timeNow.sub(bucket.timestamp)).div(365 days)
        );

        bucket.cumulativeInterestPerShare = bucket.cumulativeInterestPerShare.add(
            bucket.rate.mul(ADDITIONAL_PRECISION.div(10000)).mul(timeNow.sub(bucket.timestamp)).div(365 days)
        );
        bucket.rate = _currentRate(bucketRate, _creditScoreAdjustmentRate(bucketNumber));
        bucket.timestamp = uint128(timeNow);
    }

    function poolCreditValue(ITrueFiPool2 pool) external override view returns (uint256) {
        uint256 bitMap = usedBucketsBitmap;
        CreditScoreBucket[256] storage creditScoreBuckets = buckets[pool];
        uint256 timeNow = block.timestamp;
        uint256 value = poolTotalInterest[pool].div(1e27);

        for (uint16 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            CreditScoreBucket storage bucket = creditScoreBuckets[i];

            value = value.add(bucket.totalBorrowed).add(
                bucket.rate.mul(1e23).mul(bucket.totalBorrowed).mul(timeNow.sub(bucket.timestamp)).div(365 days).div(1e27)
            );
        }
        return value.sub(poolTotalPaidInterest[pool]);
    }

    function singleCreditValue(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        return borrowed[pool][borrower].add(interest(pool, borrower));
    }

    function status(ITrueFiPool2 pool, address borrower) public view returns (Status) {
        if (creditOracle.ineligible(borrower)) {
            return Status.Ineligible;
        }
        if (creditOracle.onHold(borrower)) {
            return Status.OnHold;
        }
        if (nextInterestRepayTime[pool][borrower] == 0) {
            return Status.Eligible;
        }
        if (nextInterestRepayTime[pool][borrower] < block.timestamp) {
            return Status.OnHold;
        }
        return Status.Eligible;
    }

    /**
     * @dev check if borrower score has been updated recently enough
     * @return Whether block timestamp is less than last update + threshold
     */
    function meetsTimeRequirement(address borrower) public view returns (bool) {
        return block.timestamp <= creditScoreUpdateThreshold.add(creditOracle.lastUpdated(borrower));
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
        uint256 borrowedByBorrower = borrowed[pool][borrower];
        // prettier-ignore
        return
            bucket.savedInterest[borrower].total.add(
                bucket.cumulativeInterestPerShare
                    .sub(bucket.savedInterest[borrower].perShare)
                    .mul(borrowedByBorrower)
                    .div(ADDITIONAL_PRECISION)
            ).add(
                block.timestamp.sub(bucket.timestamp)
                .mul(borrowedByBorrower)
                .mul(bucket.rate)
                .div(10000)
                .div(365 days)
            );
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

    function saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        if (b > a) {
            return 0;
        }
        return a.sub(b);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }
}
