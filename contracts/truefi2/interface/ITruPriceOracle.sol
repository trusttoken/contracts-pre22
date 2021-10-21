// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

/**
 * @dev Oracle that converts TRU token to USD
 */
interface ITruPriceOracle {
    function truToUsd(uint256 tokenAmount) external view returns (uint256);
}
