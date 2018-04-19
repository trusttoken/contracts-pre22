pragma solidity ^0.4.21;

import "../modularERC20/ModularStandardToken.sol";

contract StandardTokenMock is ModularStandardToken {
    function StandardTokenMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
