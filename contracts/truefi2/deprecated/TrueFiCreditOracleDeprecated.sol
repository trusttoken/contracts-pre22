// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiCreditOracleDeprecated} from "./ITrueFiCreditOracleDeprecated.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

/**
 * @title TrueFiCreditOracleDeprecated
 * @dev Contract which allows the storage of credit scores for
 * TrueFi borrower accounts.
 */
contract TrueFiCreditOracleDeprecated is ITrueFiCreditOracleDeprecated, UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Track credit scores for an account
    mapping(address => uint8) score;

    // ======= STORAGE DECLARATION END ============

    function initialize() public initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    /**
     * @dev Get score for `account`
     * Scores are stored as uint8 allowing scores of 0-255
     */
    function getScore(address account) public override view returns (uint8) {
        return score[account];
    }

    /**
     * @dev Set `newScore` value for `account`
     * Scores are stored as uint8 allowing scores of 0-255
     */
    function setScore(address account, uint8 newScore) public onlyOwner {
        score[account] = newScore;
    }
}
