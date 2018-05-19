pragma solidity ^0.4.23;

import "../modularERC20/ModularBasicToken.sol";

contract BasicTokenMock is ModularBasicToken {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
