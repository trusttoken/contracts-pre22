// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegistryClone {
    function syncAttributeValue(
        address _who,
        bytes32 _attribute,
        uint256 _value
    ) external;
}
