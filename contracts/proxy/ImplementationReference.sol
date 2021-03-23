// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ImplementationReference is Ownable {
    address public implementation;

    event ImplementationChanged(address newImplementation);

    constructor(address _implementation) public Ownable() {
        implementation = _implementation;
    }

    function setImplementation(address newImplementation) external onlyOwner {
        implementation = newImplementation;
        emit ImplementationChanged(newImplementation);
    }
}
