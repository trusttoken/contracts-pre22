// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IMockTruPriceOracle} from "./../interface/IMockTruPriceOracle.sol";

contract MockTruPriceOracle is IMockTruPriceOracle {
    //from tusd to tru
    function toTru(uint256 amount) public override returns (uint256) {
        return (amount * 4) / 1e10;
    }
}
