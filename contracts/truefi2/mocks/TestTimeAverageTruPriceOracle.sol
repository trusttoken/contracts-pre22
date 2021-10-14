// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TimeAverageTruPriceOracle, AggregatorV3Interface} from "../oracles/TimeAverageTruPriceOracle.sol";

contract TestTimeAverageTruPriceOracle is TimeAverageTruPriceOracle {
    constructor(AggregatorV3Interface mockAggregator) public {
        truPriceFeed = mockAggregator;
    }

    function getBufferPrices() external view returns (uint192[255] memory buf) {
        for (uint256 i = 0; i < 255; i++) {
            buf[i] = buffer[i].price;
        }
    }

    function testFillBuffer(uint192[] calldata prices) external {
        uint64 timeNow = uint64(block.timestamp);
        for (uint256 i = 0; i < prices.length; i++) {
            buffer[i] = TimeAverageTruPriceOracle.PricePoint(0, prices[i], timeNow);
        }
        rightIndex = prices.length - 1;
    }
}
