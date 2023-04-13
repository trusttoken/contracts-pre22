// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IClaimableOwnable {
    function claimOwnership() external;

    function transferOwnership(address newOwner) external;
}
