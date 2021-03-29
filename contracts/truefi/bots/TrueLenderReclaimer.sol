// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken} from "../interface/ILoanToken.sol";
import {TrueLender} from "../TrueLender.sol";

/**
 * @title TrueLenderReclaimer
 * @dev Bot to automate reclamation of settled TrueLender loans.
 * Only accesses public/external functions, hence safe to run by anyone
 */
 contract TrueLenderReclaimer {

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    TrueLender public _lender;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when funds are reclaimed from a LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     */
    event Reclaimed(address indexed loanToken);

    constructor(TrueLender lender) public {
        _lender = lender;
    }

    /**
     * @dev Reclaim funds from all settled loans in lender
     * Only uses publicly accessible functions of TrueLender, so this is safe to run by anyone.
     */
    function reclaimAll() public {
        ILoanToken[] memory loans = _lender.loans();
        for (uint256 index = 0; index < loans.length; index++) {
            ILoanToken loanToken = loans[index];
            if (loanToken.status() == ILoanToken.Status.Settled) {
                _lender.reclaim(loanToken);
                emit Reclaimed(address(loanToken));
            }
        }
    }
 }