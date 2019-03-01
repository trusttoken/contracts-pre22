pragma solidity ^0.4.23;

import "../modularERC20/ModularBurnableToken.sol";

contract BurnableTokenMock is ModularBurnableToken {
    constructor(address initialAccount, uint initialBalance) public {
        balances = new BalanceSheet();
        balanceOf[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
    }
}
