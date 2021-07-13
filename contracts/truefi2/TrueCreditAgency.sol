// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20, SafeMath} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {ABDKMath64x64} from "./libraries/ABDKMath64x64.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

contract TrueCreditAgency is UpgradeableClaimable {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using ABDKMath64x64 for int128;

    uint8 constant MAX_CREDIT_SCORE = 255;
    uint256 constant MAX_RATE_CAP = 50000;

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

    mapping(ITrueFiPool2 => bool) public isPoolAllowed;
    ITrueFiPool2[] public pools;

    mapping(address => bool) public isBorrowerAllowed;

    // basis precision: 10000 = 100%
    uint256 public riskPremium;

    // basis precision: 10000 = 100%
    uint256 public creditAdjustmentCoefficient;

    BorrowLimitConfig public borrowLimitConfig;

    ITrueFiCreditOracle public creditOracle;

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

    // ======= STORAGE DECLARATION END ============

    event RiskPremiumChanged(uint256 newRate);

    event BorrowerAllowed(address indexed who, bool status);

    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    event BorrowLimitConfigChanged(
        uint8 scoreFloor,
        uint16 limitAdjustmentPower,
        uint16 tvlLimitCoefficient,
        uint16 poolValueLimitCoefficient
    );

    function initialize(ITrueFiCreditOracle _creditOracle, uint256 _riskPremium) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = _riskPremium;
        creditOracle = _creditOracle;
        creditAdjustmentCoefficient = 1000;
        borrowLimitConfig = BorrowLimitConfig(40, 7500, 1500, 1500);
        utilizationAdjustmentCoefficient = 50;
        utilizationAdjustmentPower = 2;
    }

    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        emit RiskPremiumChanged(newRate);
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

    modifier onlyAllowedBorrowers() {
        require(isBorrowerAllowed[msg.sender], "TrueCreditAgency: Sender is not allowed to borrow");
        _;
    }

    function allowBorrower(address who, bool status) external onlyOwner {
        isBorrowerAllowed[who] = status;
        emit BorrowerAllowed(who, status);
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
        uint8 oldScore = creditScore[pool][borrower];
        uint8 newScore = creditOracle.getScore(borrower);
        if (oldScore == newScore) {
            return;
        }

        _rebucket(pool, borrower, oldScore, newScore, borrowed[pool][borrower]);
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
        return ((ABDKMath64x64.fromUInt(score) / MAX_CREDIT_SCORE).pow(borrowLimitConfig.limitAdjustmentPower) * 10000).toUInt();
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
        return floorSub(poolBorrowMax, totalBorrowed(borrower, poolDecimals));
    }

    function interest(ITrueFiPool2 pool, address borrower) external view returns (uint256) {
        CreditScoreBucket storage bucket = buckets[pool][creditScore[pool][borrower]];
        return _interest(pool, bucket, borrower);
    }

    function borrow(ITrueFiPool2 pool, uint256 amount) external onlyAllowedBorrowers {
        require(isPoolAllowed[pool], "TrueCreditAgency: The pool is not whitelisted for borrowing");
        uint8 oldScore = creditScore[pool][msg.sender];
        uint8 newScore = creditOracle.getScore(msg.sender);

        _rebucket(pool, msg.sender, oldScore, newScore, borrowed[pool][msg.sender].add(amount));

        pool.borrow(amount);
        pool.token().safeTransfer(msg.sender, amount);
    }

    function repay(ITrueFiPool2 pool, uint256 amount) external {
        pool.token().safeTransferFrom(msg.sender, address(this), amount);
        pool.token().safeApprove(address(pool), amount);
        pool.repay(amount);
    }

    function poke(ITrueFiPool2 pool) public {
        uint256 bitMap = usedBucketsBitmap;
        CreditScoreBucket[256] storage creditScoreBuckets = buckets[pool];
        uint256 timeNow = block.timestamp;

        for (uint16 i = 0; i <= MAX_CREDIT_SCORE; (i++, bitMap >>= 1)) {
            if (bitMap & 1 == 0) {
                continue;
            }

            CreditScoreBucket storage bucket = creditScoreBuckets[i];

            bucket.cumulativeInterestPerShare = bucket.cumulativeInterestPerShare.add(
                bucket.rate.mul(1e23).mul(timeNow.sub(bucket.timestamp)).div(365 days)
            );
            bucket.rate = _creditScoreAdjustmentRate(uint8(i)).add(riskPremium);
            bucket.timestamp = uint128(timeNow);
        }
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
        creditScore[pool][borrower] = newScore;
        CreditScoreBucket storage bucket = buckets[pool][newScore];
        _putIntoBucket(pool, bucket, newScore, borrower);
        poke(pool);
        bucket.savedInterest[borrower] = SavedInterest(totalBorrowerInterest, bucket.cumulativeInterestPerShare);
    }

    function _takeOutOfBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal returns (uint256 totalBorrowerInterest) {
        require(bucket.borrowersCount > 0, "TrueCreditAgency: bucket is empty");
        bucket.borrowersCount -= 1;
        if (bucket.borrowersCount == 0) {
            usedBucketsBitmap &= ~(uint256(1) << bucketNumber);
        }
        bucket.totalBorrowed = bucket.totalBorrowed.sub(borrowed[pool][borrower]);
        totalBorrowerInterest = _interest(pool, bucket, borrower);
        delete bucket.savedInterest[borrower];
    }

    function _putIntoBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        uint8 bucketNumber,
        address borrower
    ) internal {
        bucket.borrowersCount = bucket.borrowersCount + 1;
        if (bucket.borrowersCount == 1) {
            usedBucketsBitmap |= uint256(1) << bucketNumber;
        }
        bucket.totalBorrowed = bucket.totalBorrowed.add(borrowed[pool][borrower]);
    }

    function _interest(
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
                    .div(1e27)
            ).add(
                block.timestamp.sub(bucket.timestamp)
                .mul(borrowedByBorrower)
                .mul(bucket.rate)
                .div(10000)
                .div(365 days)
            );
    }

    function floorSub(uint256 a, uint256 b) internal pure returns (uint256) {
        if (b > a) {
            return 0;
        }
        return a.sub(b);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }
}
