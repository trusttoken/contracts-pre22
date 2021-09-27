// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../LoanFactory2.sol";

contract TestLoanFactory is LoanFactory2 {
    function setIsLoanToken(address loanToken) external {
        isLoanToken[ILoanToken2(loanToken)] = true;
    }
}
