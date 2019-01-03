pragma solidity ^0.4.23;

import "../DelegateERC20.sol";

contract DelegateERC20Mock is DelegateERC20 {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
