pragma solidity 0.5.13;

import { Registry } from "@trusttoken/registry/contracts/Registry.sol";
import { ProvisionalRegistry } from "@trusttoken/registry/contracts/ProvisionalRegistry.sol";

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
contract ProvisionalRegistryImplementation is
    RegistryImplementation,
    ProvisionalRegistry {
}