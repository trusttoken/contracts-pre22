// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";

/**
 * @dev Library that has shared functions between legacy TrueFi Pool and Pool2
 */
library PoolExtensions {
    function _liquidate(
        address safu,
        ILoanToken2 loan,
        ITrueLender2 lender
    ) internal {
        require(msg.sender == safu, "TrueFiPool: Should be called by SAFU");
        lender.transferAllLoanTokens(loan, safu);
    }
}
