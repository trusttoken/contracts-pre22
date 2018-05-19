pragma solidity ^0.4.23;

import "../StandardDelegate.sol";

contract StandardDelegateMock is StandardDelegate {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
