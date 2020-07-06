// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../BurnableTokenWithBounds.sol";

contract BurnableTokenWithBoundsMock is BurnableTokenWithBounds {
    constructor(address initialAccount, uint initialBalance) public {
        _setBalance(initialAccount,  initialBalance);
        totalSupply_ = initialBalance;
    }
}
