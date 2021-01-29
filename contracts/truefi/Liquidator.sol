// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "./common/UpgradeableOwnable.sol";
import {LoanToken, IERC20} from "./LoanToken.sol";

import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";

/**
 * @title Liquidator
 * @notice Liquidate LoanTokens with this Contract
 * @dev When a Loan becomes defaulted, Liquidator allows to
 * compensate pool participants, by transfering some of TRU to the pool
 */
contract Liquidator is Ownable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ITrueFiPool public _pool;
    IERC20 public _stakingPool;

    // max share of tru to be taken from staking pool during liquidation
    // 1000 -> 10%
    uint256 public fetchMaxShare;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted fetch max share is changed
     * @param newShare New share set
     */
    event FetchMaxShareChanged(uint256 newShare);

    /**
     * @dev Initialize this contract
     */
    function initialize(ITrueFiPool __pool, IERC20 __stakingPool) public initializer {
        Ownable.initialize();

        _pool = __pool;
        _stakingPool = __stakingPool;
        fetchMaxShare = 1000;
    }

    /**
     * @dev Set new max fetch share
     * @param newShare New share to be set
     */
    function setFetchMaxShare(uint256 newShare) external onlyOwner {
        require(newShare > 0, "Liquidator: Share cannot be set to 0");
        fetchMaxShare = newShare;
        emit FetchMaxShareChanged(newShare);
    }

    /**
     * @dev Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
     * then transfers tru to TrueFiPool as compensation
     * @param loan Loan to be liquidated
     */
    function liquidate(ILoanToken loan) external {
        loan.liquidate();
    }
}
