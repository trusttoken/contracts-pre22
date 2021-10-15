// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract TimeAverageTruPriceOracle {
    using SafeMath for uint256;

    uint8 constant BUFFER_LEN = 255;
    uint64 constant TIME_WINDOW = 7 days;

    struct PricePoint {
        uint256 runningTotal;
        uint192 price;
        uint64 timestamp;
    }

    PricePoint[BUFFER_LEN] public buffer;

    AggregatorV3Interface public truPriceFeed;

    uint256 public leftIndex;
    uint256 public rightIndex;

    /**
     * Network: Mainnet
     * Aggregator: TRU/USD
     * Address: 0x26929b85fE284EeAB939831002e1928183a10fb1
     */
    constructor() public {
        truPriceFeed = AggregatorV3Interface(0x26929b85fE284EeAB939831002e1928183a10fb1);
        buffer[0] = PricePoint(0, 0, uint64(block.timestamp));
    }

    /**
     * @dev return the latest price for TRU/USD with 8 decimals places
     * @return TRU/USD price
     */
    function getLatestTruPrice() public view returns (uint192) {
        (, int256 price, , , ) = truPriceFeed.latestRoundData();
        return safeUint192(price);
    }

    function poke() external {
        uint64 timeNow = uint64(block.timestamp);
        uint192 price = getLatestTruPrice();
        uint256 skipCount = 0;
        if (rightIndex == leftIndex && buffer[BUFFER_LEN - 1].timestamp > 0) {
            // Buffer did full cycle
            // This shouldn't be generally happening when COOLDOWN * BUFFER_LEN > TIME_WINDOW
            leftIndex = next(leftIndex);
        }
        uint64 dt = timeNow - buffer[rightIndex].timestamp;
        uint256 previousTotal = buffer[rightIndex].runningTotal;
        rightIndex = next(rightIndex);
        buffer[rightIndex] = PricePoint(uint256(price).mul(dt).add(previousTotal), price, timeNow);
        uint256 nextLeftIndex = leftIndex;
        while (true) {
            nextLeftIndex = next(nextLeftIndex);
            if (nextLeftIndex == rightIndex) {
                break;
            }
            PricePoint storage point = buffer[nextLeftIndex];
            if (point.timestamp + TIME_WINDOW > timeNow) {
                break;
            }
            skipCount++;
        }
        leftIndex = (skipCount + leftIndex) % BUFFER_LEN;
    }

    /**
     * @dev converts from TRU with 8 decimals to USD with 18 decimals
     * @param truAmount Amount in TRU
     * @return USD value of TRU input
     */
    function truToUsd(uint256 truAmount) external view returns (uint256) {
        uint256 latestPrice = getLatestTruPrice();
        uint256 timeNow = block.timestamp;
        uint256 runningTotalDiff = buffer[rightIndex].runningTotal.sub(buffer[leftIndex].runningTotal).add(
            latestPrice.mul(timeNow.sub(buffer[rightIndex].timestamp))
        );
        uint256 dt = timeNow.sub(buffer[leftIndex].timestamp);
        uint256 truInUsd = truAmount.mul(runningTotalDiff).div(dt); // 16 dec places
        // 10^16 * 10^2 = 10^18
        return truInUsd.mul(100);
    }

    function next(uint256 index) internal pure returns (uint256) {
        return (index + 1) % BUFFER_LEN;
    }

    /**
     * @dev convert int256 to uint256
     * @param value to convert to uint
     * @return the converted uint256 value
     */
    function safeUint192(int256 value) internal pure returns (uint192) {
        require(value >= 0, "TimeAveragePriceOracle: uint underflow");
        require(value <= type(uint192).max, "TimeAveragePriceOracle: uint192 overflow");
        return uint192(value);
    }
}
