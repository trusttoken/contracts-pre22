// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

contract ImplementationReference {
    address public owner;
    address public implementation;

    event ImplementationChanged(address newImplementation);

    modifier onlyOwner() {
        require(msg.sender == owner, "ImplementationReference: Caller is not the owner");
        _;
    }

    constructor(address _implementation) public {
        owner = msg.sender;
        implementation = _implementation;
    }

    function setImplementation(address newImplementation) external onlyOwner {
        implementation = newImplementation;
        emit ImplementationChanged(newImplementation);
    }
}
