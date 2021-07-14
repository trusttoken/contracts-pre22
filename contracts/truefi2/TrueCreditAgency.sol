// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20, SafeMath} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";

contract TrueCreditAgency is UpgradeableClaimable {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    uint8 MAX_CREDIT_SCORE = 255;

    struct SavedInterest {
        uint256 total;
        uint256 perShare;
    }

    struct CreditScoreBucket {
        uint16 borrowersCount;
        uint128 timestamp;
        uint256 rate;
        uint256 cumulativeInterestPerShare; // How much interest was gathered by 1 wei times 10^18
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

    mapping(ITrueFiPool2 => bool) public isPoolAllowed;

    mapping(address => bool) public isBorrowerAllowed;

    // basis precision: 10000 = 100%
    uint256 public riskPremium;

    // basis precision: 10000 = 100%
    uint256 public creditAdjustmentCoefficient;

    ITrueFiCreditOracle public creditOracle;

    // ======= STORAGE DECLARATION END ============

    event RiskPremiumChanged(uint256 newRate);

    event BorrowerAllowed(address indexed who, bool status);

    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    function initialize(ITrueFiCreditOracle _creditOracle, uint256 _riskPremium) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = _riskPremium;
        creditOracle = _creditOracle;
        creditAdjustmentCoefficient = 1000;
    }

    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        emit RiskPremiumChanged(newRate);
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
            return 50000; // Cap rate by 500%
        }
        return min(creditAdjustmentCoefficient.mul(MAX_CREDIT_SCORE - score).div(score), 50000);
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
        for (uint16 i = 1; i <= MAX_CREDIT_SCORE; i++) {
            CreditScoreBucket storage bucket = buckets[pool][i];
            if (bucket.borrowersCount == 0) {
                continue;
            }
            uint256 timeNow = block.timestamp;

            bucket.cumulativeInterestPerShare = bucket.cumulativeInterestPerShare.add(
                bucket.rate.mul(1e14).mul(timeNow.sub(bucket.timestamp)).div(365 days)
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
        uint256 totalBorrowed
    ) internal {
        uint256 totalBorrowerInterest = oldScore > 0 ? _takeOutOfBucket(pool, buckets[pool][oldScore], borrower) : 0;
        borrowed[pool][borrower] = totalBorrowed;
        creditScore[pool][borrower] = newScore;
        CreditScoreBucket storage bucket = buckets[pool][newScore];
        _putIntoBucket(pool, bucket, borrower);
        poke(pool);
        bucket.savedInterest[borrower] = SavedInterest(totalBorrowerInterest, bucket.cumulativeInterestPerShare);
    }

    function _takeOutOfBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        address borrower
    ) internal returns (uint256 totalBorrowerInterest) {
        require(bucket.borrowersCount > 0, "TrueCreditAgency: bucket is empty");
        bucket.borrowersCount = bucket.borrowersCount - 1;
        bucket.totalBorrowed = bucket.totalBorrowed.sub(borrowed[pool][borrower]);
        totalBorrowerInterest = _interest(pool, bucket, borrower);
        delete bucket.savedInterest[borrower];
    }

    function _putIntoBucket(
        ITrueFiPool2 pool,
        CreditScoreBucket storage bucket,
        address borrower
    ) internal {
        bucket.borrowersCount = bucket.borrowersCount + 1;
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
                    .div(1e18)
            ).add(
                block.timestamp.sub(bucket.timestamp)
                .mul(borrowedByBorrower)
                .mul(bucket.rate)
                .div(10000)
                .div(365 days)
            );
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }
}
