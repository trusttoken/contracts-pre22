// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {TrueLender2} from "../TrueLender2.sol";
import {ILoanToken2} from "../interface/ILoanToken2.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";

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
        ITrueFiPool2 pool = loanToken.pool();

        uint256 amount = loanToken.amount();

        poolLoans[pool].push(loanToken);
        pool.token().safeApprove(address(loanToken), amount);
        loanToken.fund();

        borrowingMutex.lock(msg.sender, address(loanToken));

        emit Funded(address(pool), address(loanToken), amount);
    }
}
