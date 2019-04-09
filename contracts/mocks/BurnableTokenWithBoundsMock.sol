pragma solidity ^0.4.23;

import "../BurnableTokenWithBounds.sol";

contract BurnableTokenWithBoundsMock is BurnableTokenWithBounds {
    constructor(address initialAccount, uint initialBalance) public {
        _setBalance(initialAccount,  initialBalance);
        totalSupply_ = initialBalance;
    }
}
