// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "./common/UpgradeableOwnable.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILoanFactory} from "./interface/ILoanFactory.sol";

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

    ILoanFactory public _factory;
    IERC20 public _stakingPool;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Initialize this contract
     */
    function initialize(
        ILoanFactory __factory,
        IERC20 __stakingPool
    ) public initializer {
        Ownable.initialize();

        _factory = __factory;
        _stakingPool = __stakingPool;
    }
}
