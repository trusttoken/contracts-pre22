// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ISAFU {
    function poolDeficit(address pool) external view returns (uint256);
}
