pragma solidity ^0.5.13;

import "../modularERC20/ModularBurnableToken.sol";

contract BurnableTokenMock is ModularBurnableToken {
    constructor(address initialAccount, uint initialBalance) public {
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
