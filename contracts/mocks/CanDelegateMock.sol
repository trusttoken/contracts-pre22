pragma solidity ^0.4.18;

import "../CanDelegate.sol";

contract CanDelegateMock is CanDelegate {

    function CanDelegateMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }

}
