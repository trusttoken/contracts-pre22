// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../interface/ITruPriceOracle.sol";

contract MockTruPriceOracle is ITruPriceOracle {
    //from tusd to tru
    function usdToTru(uint256 amount) external override view returns (uint256) {
        return (amount * 4) / 1e10;
    }
}
