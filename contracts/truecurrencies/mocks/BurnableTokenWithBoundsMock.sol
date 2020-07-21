// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {BurnableTokenWithBounds} from "../BurnableTokenWithBounds.sol";

contract BurnableTokenWithBoundsMock is BurnableTokenWithBounds {
    constructor(address initialAccount, uint256 initialBalance) public {
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
