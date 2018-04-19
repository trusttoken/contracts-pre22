pragma solidity ^0.4.21;

import "../StandardDelegate.sol";

contract StandardDelegateMock is StandardDelegate {
    function StandardDelegateMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
