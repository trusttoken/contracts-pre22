// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ImplementationReference
 * @dev This contract is made to serve a simple purpose only.
 * To hold the address of the implementation contract to be used by proxy.
 * The implementation address, is changeable anytime by the owner of this contract.
 */
contract ImplementationReference is Ownable {
    address public implementation;

    /**
     * @dev Event to show that implementation address has been changed
     * @param newImplementation New address of the implementation
     */
    event ImplementationChanged(address newImplementation);

    /**
     * @dev Set initial ownership and implementation address
     * @param _implementation Initial address of the implementation
     */
    constructor(address _implementation) public Ownable() {
        implementation = _implementation;
    }

    /**
     * @dev Function to change the implementation address, which can be called only by the owner
     * @param newImplementation New address of the implementation
     */
    function setImplementation(address newImplementation) external onlyOwner {
        implementation = newImplementation;
        emit ImplementationChanged(newImplementation);
    }
}
