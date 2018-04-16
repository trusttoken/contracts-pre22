pragma solidity ^0.4.18;

import "./Registry.sol";

contract HasRegistry is Ownable {
    Registry public registry;

    event SetRegistry(address indexed registry);

    function setRegistry(Registry _registry) onlyOwner public {
        registry = _registry;
        emit SetRegistry(registry);
    }
}
