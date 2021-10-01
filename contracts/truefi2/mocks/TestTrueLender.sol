// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {TrueLender2} from "../TrueLender2.sol";
import {ILoanToken2} from "../interface/ILoanToken2.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";
import {ITrueFiCreditOracle} from "../interface/ITrueFiCreditOracle.sol";

/**
 * @dev Helper contract to test distribute feature of the TrueLender2
 */
contract TestTrueLender is TrueLender2 {
    function testDistribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) external {
        _distribute(recipient, numerator, denominator, pool);
    }

    function testTransferAllLoanTokens(ILoanToken2 loan, address recipient) external {
        _transferAllLoanTokens(loan, recipient);
    }

    function fundWithOwnFunds(ILoanToken2 loanToken) external {
        require(msg.sender == loanToken.borrower(), "TrueLender: Sender is not borrower");
        ITrueFiPool2 pool = loanToken.pool();

        require(factory.isSupportedPool(pool), "TrueLender: Pool not supported by the factory");
        require(loanToken.token() == pool.token(), "TrueLender: Loan and pool token mismatch");
        require(poolLoans[pool].length < maxLoans, "TrueLender: Loans number has reached the limit");
        require(borrowingMutex.isUnlocked(msg.sender), "TrueLender: There is an ongoing loan or credit line");
        require(creditOracle.status(msg.sender) == ITrueFiCreditOracle.Status.Eligible, "TrueLender: Sender is not eligible for loan");

        uint256 term = loanToken.term();
        require(isTermBelowMax(term), "TrueLender: Loan's term is too long");
        require(isCredibleForTerm(term), "TrueLender: Credit score is too low for loan's term");

        uint256 amount = loanToken.amount();
        require(amount <= borrowLimit(pool, loanToken.borrower()), "TrueLender: Loan amount cannot exceed borrow limit");

        poolLoans[pool].push(loanToken);
        pool.token().safeApprove(address(loanToken), amount);
        loanToken.fund();

        borrowingMutex.lock(msg.sender, address(loanToken));

        emit Funded(address(pool), address(loanToken), amount);
    }
}
