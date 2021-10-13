// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {ITrueFiPoolOracle, IERC20WithDecimals} from "../interface/ITrueFiPoolOracle.sol";

abstract contract ChainlinkTruOracle is ITrueFiPoolOracle {
    using SafeMath for uint256;
    AggregatorV3Interface internal truPriceFeed;

    /**
     * Network: Mainnet
     * Aggregator: TRU/USD
     * Address: 0x26929b85fE284EeAB939831002e1928183a10fb1
     */
    constructor() public {
        truPriceFeed = AggregatorV3Interface(0x26929b85fE284EeAB939831002e1928183a10fb1);
    }

    function token() public virtual override view returns (IERC20WithDecimals);

    function tokenToUsd(uint256 tokenAmount) public virtual override view returns (uint256);

    /**
     * @dev return the latest price for TRU/USD with 8 decimals places
     * @return TRU/USD price
     */
    function getLatestTruPrice() public view returns (uint256) {
        (, int256 price, , , ) = truPriceFeed.latestRoundData();
        return safeUint(price);
    }

    /**
     * @dev converts from USD with 6 decimals to TRU with 8 decimals
     * Divide by 100 since tokenToUsd returns 18 decimals, getLatestTruPrice returns 8 and TRU is 8 decimals
     * 10^18 / 10^8 / 10^8 = 10^2
     * @param tokenAmount Amount in USDC
     * @return TRU value of USDC input
     */
    function tokenToTru(uint256 tokenAmount) external override view returns (uint256) {
        uint256 tokenValue = tokenToUsd(tokenAmount);
        return tokenValue.div(getLatestTruPrice()).div(100);
    }

    /**
     * @dev converts from TRU with 8 decimals to corresponding amount of tokens
     * @param truAmount Amount in TRU
     * @return USD value of TRU input
     */
    function truToToken(uint256 truAmount) external override view returns (uint256) {
        uint256 decimals = token().decimals();
        uint256 tokenPrice = tokenToUsd(10**decimals); // 18 dec places
        uint256 truInUsd = truAmount.mul(getLatestTruPrice()); // 16 dec places
        // 10^16 * 10^2 * 10^D / 10^18 = 10^D
        return truInUsd.mul(100).mul(10**decimals).div(tokenPrice);
    }

    /**
     * @dev convert int256 to uint256
     * @param value to convert to uint
     * @return the converted uint256 value
     */
    function safeUint(int256 value) internal pure returns (uint256) {
        require(value >= 0, "ChainlinkTruOracle: uint underflow");
        return uint256(value);
    }
}
