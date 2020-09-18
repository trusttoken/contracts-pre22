// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Registry} from "../Registry.sol";

contract MockRegistrySubscriber {
    mapping(address => mapping(bytes32 => uint256)) attributes;

    function syncAttributeValue(
        address _who,
        bytes32 _attribute,
        uint256 _value
    ) public {
        attributes[_who][_attribute] = _value;
    }

    function getAttributeValue(address _who, bytes32 _attribute) public view returns (uint256) {
        return attributes[_who][_attribute];
    }
}
