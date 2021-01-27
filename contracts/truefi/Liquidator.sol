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

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Initialize this contract
     */
    function initialize(
        ITrueFiPool __pool,
        IERC20 __stakingPool
    ) public initializer {
        Ownable.initialize();

        _pool = __pool;
        _stakingPool = __stakingPool;
    }

    function liquidate(ILoanToken loan) public {
        loan.liquidate();
    }
}
