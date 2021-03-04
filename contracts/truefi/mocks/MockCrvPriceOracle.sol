// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../interface/ICrvPriceOracle.sol";

contract MockCrvPriceOracle is ICrvPriceOracle {
    function usdToCrv(uint256 amount) external override view returns (uint256) {
        return amount * 2;
    }

    function crvToUsd(uint256 amount) external override view returns (uint256) {
        return amount / 2;
    }
}
