// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract TruPriceOracle is ITruPriceOracle {
    AggregatorV3Interface internal priceFeed;
    using SafeMath for uint256;

    /**
     * Network: Mainnet
     * Aggregator: TRU/USD
     * Address: 0x26929b85fE284EeAB939831002e1928183a10fb1
     */
    constructor() public {
        priceFeed = AggregatorV3Interface(0x26929b85fE284EeAB939831002e1928183a10fb1);
    }

    /**
     * @dev return the lastest price for TRU/USD with 8 decimals places
     * @return TRU/USD price
     */
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    /**
     * @dev converts from USD with 18 decimals to TRU with 8 decimals
     * Divide by 100 since Chainlink returns 10 decimals and TRU is 8 decimals
     * @param amount Amount in USD
     * @return TRU value of USD input
     */
    function usdToTru(uint256 amount) external override view returns (uint256) {
        return amount.div(safeUint(getLatestPrice())).div(100);
    }

    /**
     * @dev converts from TRU with 8 decimals to USD with 18 decimals
     * Multiply by 100 since Chainlink returns 10 decimals and TRU is 8 decimals
     * @param amount Amount in TRU
     * @return USD value of TRU input
     */
    function truToUsd(uint256 amount) external override view returns (uint256) {
        return amount.mul(safeUint(getLatestPrice())).mul(100);
    }

    /**
     * @dev convert int256 to uint256
     * @param value to convert to uint
     */
    function safeUint(int256 value) internal pure returns (uint256) {
        require(value >= 0, "TruPriceChainLinkOracle: uint underflow");
        return uint256(value);
    }
}
