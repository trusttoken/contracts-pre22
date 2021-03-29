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
     * @dev Emitted when a LoanToken contract is settled
     * @param loanToken LoanToken which has been closed
     */
    event Closed(address indexed loanToken);

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
     * Only uses public functions, so this is safe to run by anyone.
     */
    function reclaimAll() public {
        ILoanToken[] memory loans = _lender.loans();
        // TODO avoid iterating through an unbounded array
        for (uint256 index = 0; index < loans.length; index++) {
            ILoanToken loanToken = loans[index];
            require(loanToken.isLoanToken(), "Only LoanTokens can be reclaimed");
            if (_isRepaidInFull(loanToken)) {
                emit Closed(address(loanToken));
                loanToken.close();
            }
            if (loanToken.status() == ILoanToken.Status.Settled) {
                emit Reclaimed(address(loanToken));
                _lender.reclaim(loanToken);
            }
        }
    }

    /**
     * @dev Check whether this loan has been repaid in full
     * Only uses public functions
     * @param loanToken LoanToken to check
     */
    function _isRepaidInFull(ILoanToken loanToken) private view returns (bool) {
        return loanToken.status() == ILoanToken.Status.Withdrawn && loanToken.balance() >= loanToken.debt();
    }
 }