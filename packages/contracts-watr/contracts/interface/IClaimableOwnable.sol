// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IClaimableOwnable {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    function transferOwnership(address newOwner) external;

    function claimOwnership() external;
}
