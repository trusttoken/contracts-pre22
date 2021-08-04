// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

/**
 * @title TrueFiCreditOracle
 * @dev Contract which allows the storage of credit scores for TrueFi borrower accounts.
 * 
 * A borrower is "on hold" if they are temporarily not allowed to borrow
 * A borrower is "ineligible" if their line of credit is marked for default
 * 
 * Borrowers can only borrow if:
 *  - score was updated at least `threshold` seconds ago
 *  - borrower is not ineligible
 *  - borrower is not on hold
 *
 * Score manager can update scores, only owner can update ineligibility & onHold status
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

    // @dev How frequently a score needs to be updated for an account to borrow
    uint256 threshold;

    // store timestamp when borrower is last updated
    mapping(address => uint256) public lastUpdated;

    // @dev Track if borrower is ineligible for borrowing
    mapping(address => bool) public ineligible;

    // @dev Track if borrower is on hold from borrowing
    mapping(address => bool) public onHold;

    // ======= STORAGE DECLARATION END ============

    event ManagerChanged(address newManager);

    event ScoreChanged(address indexed account, uint8 indexed newScore, uint256 indexed timestamp);

    event ThresholdChanged(uint256 newThreshold);

    event IneligibleStatusChanged(address account, bool ineligibleStatus);

    event OnHoldStatusChanged(address account, bool onHoldStatus);

    function initialize() public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        threshold = 30 days;
        emit ThresholdChanged(threshold);
    }

    // @dev only credit score manager
    modifier onlyManager() {
        require(msg.sender == manager, "TrueFiCreditOracle: Caller is not the manager");
        _;
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
        score[account] = newScore;
        lastUpdated[account] = block.timestamp;
        emit ScoreChanged(account, newScore, block.timestamp);
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
        maxBorrowerLimit[account] = newMaxBorrowerLimit;
    }

    /**
     * @dev Set new manager for updating scores
     */
    function setManager(address newManager) public onlyOwner {
        manager = newManager;
        emit ManagerChanged(newManager);
    }

    /**
     * @dev Set new threshold for updating credit scores
     */
    function setThreshold(uint256 newThreshold) public onlyOwner{
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    /**
     * @dev Set ineligability
     */
    function setIneligible(address borrower, bool ineligibleStatus) public onlyOwner {
        ineligible[borrower] = ineligibleStatus;
        emit IneligibleStatusChanged(borrower, ineligibleStatus);
    }

    /**
     * @dev Set onHold status
     */
    function setOnHoldStatus(address borrower, bool onHoldStatus) public onlyOwner {
        onHold[borrower] = onHoldStatus;
        emit OnHoldStatusChanged(borrower, onHoldStatus);
    }

    /**
     * @dev check if borrower score has been updated recently enough
     * @return Whether block timestamp is less than last update + threshold
     */
    function meetsTimeRequirement(address borrower) public view returns (bool) {
        return block.timestamp <= threshold.add(lastUpdated[borrower]);
    }

    /**
     * @dev can borrow if an address is not ineligable and not on hold
     * and meets time requirements
     * @return Whether borrower can borrow more funds
     */
    function canBorrow(address borrower) public view returns (bool) {
        return !ineligible[borrower] && !onHold[borrower] && meetsTimeRequirement(borrower);
    }
}
