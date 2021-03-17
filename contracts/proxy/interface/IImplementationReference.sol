// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IImplementationReference {
    function implementation() external view returns (address currentImplementation);
}
