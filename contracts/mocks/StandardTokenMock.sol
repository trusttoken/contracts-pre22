pragma solidity ^0.4.23;

import "../modularERC20/ModularStandardToken.sol";

contract StandardTokenMock is ModularStandardToken {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
