pragma solidity ^0.4.18;

import "../modularERC20/ModularBasicToken.sol";

contract BasicTokenMock is ModularBasicToken {

    function BasicTokenMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }

}
