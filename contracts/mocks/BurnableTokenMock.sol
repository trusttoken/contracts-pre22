pragma solidity ^0.4.21;

import "../modularERC20/ModularBurnableToken.sol";

contract BurnableTokenMock is ModularBurnableToken {
    function BurnableTokenMock(address initialAccount, uint initialBalance) public {
        balances = new BalanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
