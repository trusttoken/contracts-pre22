// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegistry {
    function hasAttribute(address _who, bytes32 _attribute) external view returns (bool);
}
