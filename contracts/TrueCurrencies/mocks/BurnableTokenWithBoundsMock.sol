pragma solidity ^0.5.13;

import "../BurnableTokenWithBounds.sol";

contract BurnableTokenWithBoundsMock is BurnableTokenWithBounds {
    constructor(address initialAccount, uint initialBalance) public {
        _setBalance(initialAccount,  initialBalance);
        totalSupply_ = initialBalance;
    }
}
