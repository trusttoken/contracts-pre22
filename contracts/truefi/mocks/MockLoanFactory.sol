// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {LoanFactory} from "../LoanFactory.sol";

contract MockLoanFactory is LoanFactory {
    function setLender(address newLender) external {
        lender = newLender;
    }
}
