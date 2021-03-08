// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICrvPriceOracle} from "./interface/ICrvPriceOracle.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract CrvPriceOracle is ICrvPriceOracle {
    AggregatorV3Interface internal crvPriceFeed;
    AggregatorV3Interface internal ethPriceFeed;
    using SafeMath for uint256;

    /**
     * Network: Mainnet
     * Aggregator: CRV/ETH
     * Address: 0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e
     * Network: Mainnet
     * Aggregator: ETH/USD
     * Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
     * Mainnet deployed: https://etherscan.io/address/0x23DE9562bf8020f5B92a2A04C59b39deABbB2315#readContract
     */
    constructor() public {
        crvPriceFeed = AggregatorV3Interface(0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e);
        ethPriceFeed = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    }

    /**
     * @dev return the lastest price for CRV/USD with 18 decimals places
     * @return CRV/USD price
     */
    function getLatestPrice() public view returns (uint256) {
        (, int256 crvEthPrice, , , ) = crvPriceFeed.latestRoundData();
        (, int256 ethPrice, , , ) = ethPriceFeed.latestRoundData();
        uint256 crvPrice = safeUint(crvEthPrice).mul(safeUint(ethPrice)).div(1e8);
        return crvPrice;
    }

    /**
     * @dev converts from USD with 18 decimals to CRV with 18 decimals
     * @param amount Amount in USD
     * @return CRV value of USD input
     */
    function usdToCrv(uint256 amount) external override view returns (uint256) {
        return amount.mul(1e18).div(getLatestPrice());
    }

    /**
     * @dev converts from CRV with 18 decimals to USD with 18 decimals
     * @param amount Amount in CRV
     * @return USD value of CRV input
     */
    function crvToUsd(uint256 amount) external override view returns (uint256) {
        return amount.mul(getLatestPrice()).div(1e18);
    }

    /**
     * @dev convert int256 to uint256
     * @param value to convert to uint
     * @return the converted uint256 value
     */
    function safeUint(int256 value) internal pure returns (uint256) {
        require(value >= 0, "CrvPriceChainLinkOracle: uint underflow");
        return uint256(value);
    }
}
