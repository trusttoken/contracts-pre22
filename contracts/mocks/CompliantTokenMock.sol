pragma solidity ^0.4.23;

import "../CompliantDepositTokenWithHook.sol";

contract CompliantTokenMock is CompliantDepositTokenWithHook {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
