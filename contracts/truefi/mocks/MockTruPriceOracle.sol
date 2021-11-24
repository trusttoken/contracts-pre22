// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../interface/ITruPriceOracle.sol";

contract MockTruPriceOracle is ITruPriceOracle {
    function usdToTru(uint256 amount) external view override returns (uint256) {
        return (amount * 4) / 1e10;
    }

    function truToUsd(uint256 amount) external view override returns (uint256) {
        return (amount * 1e10) / 4;
    }
}
