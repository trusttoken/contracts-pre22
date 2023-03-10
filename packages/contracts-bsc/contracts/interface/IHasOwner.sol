// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IHasOwner {
    function claimOwnership() external;

    function transferOwnership(address newOwner) external;
}
