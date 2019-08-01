pragma solidity ^0.4.23;

import "../../registry/contracts/Registry.sol";

contract FallbackRegistrar {
    Registry public constant registry = Registry(0x0000000000013949F288172bD7E36837bDdC7211);
    bytes32 public constant IS_REGISTERED_CONTRACT = bytes32("isRegisteredContract");
    function() external payable {
        assembly {
            caller_type := extcodehash(caller)
            if eq(caller_type, 0) {
                revert(0,0)
            }
            if eq(caller_type, 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470) {
                revert(0,0)
            }
        }
        registry.setAttributeValue(msg.sender, IS_REGISTERED_CONTRACT, 1);
    }
}
