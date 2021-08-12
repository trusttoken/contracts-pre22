// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Math} from "@openzeppelin/contracts/math/Math.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

/**
 * @title TrueFiCreditOracle
 * @dev Contract which allows the storage of credit scores for TrueFi borrower accounts.
 *
 * Eligible accounts transition to OnHold after creditUpdatePeriod since their last credit update.
 * OnHold accounts cannot borrow. They transition to Ineligible after gracePeriod.
 * Ineligible accounts cannot borrow. If they owe outstanding debt, we can trigger a technical default.
 *
 * Score manager can update scores, but only owner can override eligibility Status
 */
contract TrueFiCreditOracle is ITrueFiCreditOracle, UpgradeableClaimable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Track credit scores for an account
    mapping(address => uint8) score;

    // @dev Track max borrowing limit for an account
    mapping(address => uint256) maxBorrowerLimit;

    // @dev Manager role authorized to set credit scores
    address public manager;

    // @dev Timestamp (in seconds since Unix epoch) when score eligibility expires
    mapping(address => uint256) public eligibleUntilTime;

    // @dev Duration in seconds between mandatory credit score updates
    uint256 public creditUpdatePeriod;

    // @dev Grace period in seconds before OnHold transitions to Ineligible
    uint256 public gracePeriod;

    // ======= STORAGE DECLARATION END ============

    event ManagerChanged(address newManager);

    event ScoreChanged(address indexed account, uint8 indexed newScore);

    event MaxBorrowerLimitChanged(address indexed account, uint256 newMaxBorrowerLimit);

    event EligibleUntilTimeChanged(address indexed account, uint256 timestamp);

    event CreditUpdatePeriodChanged(uint256 newCreditUpdatePeriod);

    event GracePeriodChanged(uint256 newGracePeriod);

    function initialize() public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        manager = msg.sender;
        creditUpdatePeriod = 31 days;
        gracePeriod = 3 days;
    }

    // @dev only credit score manager
    modifier onlyManager() {
        require(msg.sender == manager, "TrueFiCreditOracle: Caller is not the manager");
        _;
    }

    function setCreditUpdatePeriod(uint256 newCreditUpdatePeriod) external onlyOwner {
        creditUpdatePeriod = newCreditUpdatePeriod;
        emit CreditUpdatePeriodChanged(newCreditUpdatePeriod);
    }

    function setGracePeriod(uint256 newGracePeriod) external onlyOwner {
        gracePeriod = newGracePeriod;
        emit GracePeriodChanged(newGracePeriod);
    }

    function status(address account) external override view returns (Status) {
        if (block.timestamp < eligibleUntilTime[account]) {
            return Status.Eligible;
        } else if (block.timestamp.sub(gracePeriod) < eligibleUntilTime[account]) {
            return Status.OnHold;
        }
        return Status.Ineligible;
    }

    /**
     * @dev Get score for `account`
     * Scores are stored as uint8 allowing scores of 0-255
     * @return Credit score for account
     */
    function getScore(address account) public override view returns (uint8) {
        return score[account];
    }

    /**
     * @dev Set `newScore` value for `account`
     * Scores are stored as uint8 allowing scores of 0-255
     */
    function setScore(address account, uint8 newScore) public onlyManager {
        _setEligibleUntilTime(account, Math.max(eligibleUntilTime[account], block.timestamp.add(creditUpdatePeriod)));
        score[account] = newScore;
        emit ScoreChanged(account, newScore);
    }

    /**
     * @dev Get max borrow limit for `account`
     * Limit should be stored with 18 decimal precision
     */
    function getMaxBorrowerLimit(address account) public override view returns (uint256) {
        return maxBorrowerLimit[account];
    }

    /**
     * @dev Set `newMaxBorrowerLimit` value for `account`
     */
    function setMaxBorrowerLimit(address account, uint256 newMaxBorrowerLimit) public onlyManager {
        _setEligibleUntilTime(account, Math.max(eligibleUntilTime[account], block.timestamp.add(creditUpdatePeriod)));
        maxBorrowerLimit[account] = newMaxBorrowerLimit;
        emit MaxBorrowerLimitChanged(account, newMaxBorrowerLimit);
    }

    /**
     * @dev Set new manager for updating scores
     */
    function setManager(address newManager) public onlyOwner {
        manager = newManager;
        emit ManagerChanged(newManager);
    }

    /**
     * @dev Manually override Eligible status duration
     */
    function setEligibleForDuration(address account, uint256 duration) external onlyOwner {
        _setEligibleUntilTime(account, block.timestamp.add(duration));
    }

    /**
     * @dev Manually override status to OnHold
     */
    function setOnHold(address account) external onlyOwner {
        _setEligibleUntilTime(account, block.timestamp);
    }

    /**
     * @dev Manually override status to Ineligible
     */
    function setIneligible(address account) external onlyOwner {
        _setEligibleUntilTime(account, block.timestamp.sub(gracePeriod));
    }

    function _setEligibleUntilTime(address account, uint256 timestamp) private {
        eligibleUntilTime[account] = timestamp;
        emit EligibleUntilTimeChanged(account, timestamp);
    }
}
