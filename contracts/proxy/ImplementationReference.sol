// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IImplementationReference} from "./interface/IImplementationReference.sol";

contract ImplementationReference is IImplementationReference {
    address public owner;
    address private currentImplementation;

    event ImplementationChanged(address newImplementation);

    modifier onlyOwner() {
        require(msg.sender == owner, "ImplementationReference: Caller is not the owner");
        _;
    }

    constructor(address _implementation) public {
        owner = msg.sender;
        currentImplementation = _implementation;
    }

    function setImplementation(address newImplementation) external onlyOwner {
        currentImplementation = newImplementation;
        emit ImplementationChanged(newImplementation);
    }

    function implementation() external override view returns (address) {
        return currentImplementation;
    }
}
