// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IClaimableOwnable {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function transferOwnership(address newOwner) external;

    function claimOwnership() external;
}
