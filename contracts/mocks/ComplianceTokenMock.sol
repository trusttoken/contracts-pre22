pragma solidity ^0.4.21;

import "../ComplianceToken.sol";

contract ComplianceTokenMock is ComplianceToken {
    function ComplianceTokenMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
