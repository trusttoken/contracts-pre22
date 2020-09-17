// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Registry} from "../Registry.sol";
import {ProvisionalRegistry} from "./ProvisionalRegistry.sol";

contract RegistryMock is Registry {
    /**
     * @dev sets the original `owner` of the contract to the sender
     * at construction. Must then be reinitialized
     */
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    function initialize() public {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }
}

// solhint-disable-next-line no-empty-blocks
contract ProvisionalRegistryMock is RegistryMock, ProvisionalRegistry {

}
