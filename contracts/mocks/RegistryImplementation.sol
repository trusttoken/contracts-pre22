// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {Registry} from "../trusttokens/Registry/Registry.sol";
import {ProvisionalRegistry} from "../trusttokens/Registry/ProvisionalRegistry.sol";

/**
 * @title RegistryImplementation
 * Used as implementation for registry in truecurrencies
 */
contract RegistryImplementation is Registry {
    /**
     * @dev sets the original `owner` of the contract to the sender
     * at construction. Must then be reinitialized
     */
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    function registryOwner() public view returns (address) {
        return owner;
    }

    function initialize() public {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }
}

/**
 * @title RegistryImplementation
 * Used as implementation for registry in truecurrencies
 */
// solhint-disable-next-line no-empty-blocks
contract ProvisionalRegistryImplementation is RegistryImplementation, ProvisionalRegistry {

}
