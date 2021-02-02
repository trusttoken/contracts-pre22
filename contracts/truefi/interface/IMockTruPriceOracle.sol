// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IMockTruPriceOracle {
    function toTru(uint256 amount) external returns (uint256);
}
