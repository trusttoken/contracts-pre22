// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITruPriceOracle {
    function usdToTru(uint256 amount) external view returns (uint256);
}
