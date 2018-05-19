pragma solidity ^0.4.23;

import "../CompliantToken.sol";

contract CompliantTokenMock is CompliantToken {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
