// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ILoanToken} from "../interface/ILoanToken.sol";
import {TrueLender} from "../TrueLender.sol";

/**
 * @title TrueLenderReclaimer
 * @dev Bot to automate reclamation of settled TrueLender loans.
 * Only accesses public/external functions, hence safe to run by anyone
 */
contract TrueLenderReclaimer {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    TrueLender public _lender;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a LoanToken contract is settled
     * @param loanToken LoanToken which has been settled
     */
    event Settled(address indexed loanToken);

    /**
     * @dev Emitted when funds are reclaimed from a LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     */
    event Reclaimed(address indexed loanToken);

    constructor(TrueLender lender) public {
        _lender = lender;
    }

    /**
     * @dev Determine whether lender has fully repaid loans
     * If called outside of a contract, this view should not cost gas
     */
    function hasSettleableLoans() public view returns (bool) {
        ILoanToken[] memory loans = _lender.loans();
        for (uint256 index = 0; index < loans.length; index++) {
            if (_isSettleable(loans[index])) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Settle all loans that have been fully repaid
     * Only uses public functions, so this is safe to run by anyone.
     */
    function settleAll() public {
        ILoanToken[] memory loans = _lender.loans();
        for (uint256 index = 0; index < loans.length; index++) {
            ILoanToken loanToken = loans[index];
            if (_isSettleable(loanToken)) {
                emit Settled(address(loanToken));
                loanToken.settle();
            }
        }
    }

    function _isSettleable(ILoanToken loanToken) private view returns (bool) {
        require(loanToken.isLoanToken(), "TrueLenderReclaimer: Only LoanTokens can be settled");
        return loanToken.status() == ILoanToken.Status.Withdrawn && loanToken.isRepaid();
    }

    /**
     * @dev Determine whether lender has settled loans
     * If called outside of a contract, this view should not cost gas
     */
    function hasReclaimableLoans() public view returns (bool) {
        ILoanToken[] memory loans = _lender.loans();
        for (uint256 index = 0; index < loans.length; index++) {
            if (_isReclaimable(loans[index])) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Reclaim funds from all settled loans in lender
     * Only uses public functions, so this is safe to run by anyone.
     */
    function reclaimAll() public {
        ILoanToken[] memory loans = _lender.loans();
        for (uint256 index = 0; index < loans.length; index++) {
            ILoanToken loanToken = loans[index];
            if (_isReclaimable(loanToken)) {
                emit Reclaimed(address(loanToken));
                _lender.reclaim(loanToken);
            }
        }
    }

    function _isReclaimable(ILoanToken loanToken) private view returns (bool) {
        require(loanToken.isLoanToken(), "TrueLenderReclaimer: Only LoanTokens can be reclaimed");
        return loanToken.status() == ILoanToken.Status.Settled;
    }
}
