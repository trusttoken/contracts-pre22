// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2Deprecated} from "./deprecated/ILoanToken2Deprecated.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ISAFU} from "./interface/ISAFU.sol";

/**
 * Deprecated
 * @dev Library that has shared functions between legacy TrueFi Pool and Pool2
 * Was created to add common functions to Pool2 and now deprecated legacy pool
 */
library PoolExtensions {
    function _liquidate(
        ISAFU safu,
        ILoanToken2Deprecated loan,
        ITrueLender2 lender
    ) internal {
        require(msg.sender == address(safu), "TrueFiPool: Should be called by SAFU");
        lender.transferAllLoanTokens(loan, address(safu));
    }
}
