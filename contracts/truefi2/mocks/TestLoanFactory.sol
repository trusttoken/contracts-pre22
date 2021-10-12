// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {LoanFactory2} from "../LoanFactory2.sol";
import {TestLegacyLoanToken2} from "./TestLegacyLoanToken2.sol";

contract TestLoanFactory is LoanFactory2 {
    event LegacyLoanCreated(TestLegacyLoanToken2 loan);

    function createLegacyLoanToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external {
        TestLegacyLoanToken2 legacyLoan = new TestLegacyLoanToken2();
        legacyLoan.initialize(
            _pool,
            borrowingMutex,
            _borrower,
            IFixedTermLoanAgency(msg.sender),
            msg.sender,
            liquidator,
            address(0),
            _amount,
            _term,
            _apy
        );
        isLegacyLoanToken[legacyLoan] = true;
        emit LegacyLoanCreated(legacyLoan);
    }

    function setIsLoanToken(address loanToken) external {
        isLoanToken[ILoanToken2(loanToken)] = true;
    }
}
