// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Registry} from "../test/Registry.sol";

contract RegistryMock is Registry {
    /**
     * @dev sets the original `owner` of the contract to the sender
     * at construction. Must then be reinitialized
     */
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }
}
