// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";

interface IChainLink {
    function latestAnswer() external view returns (int256);
}

contract TruPriceChainLinkOracle is ITruPriceOracle {
    using SafeMath for uint256;

    IChainLink public chainlinkOracle;

    /**
     * @param _chainlinkOracle ChainLink Oracle address
     */
    constructor(IChainLink _chainlinkOracle) public {
        chainlinkOracle = _chainlinkOracle;
    }

    /**
     * @dev converts from USD with 18 decimals to TRU with 8 decimals
     * Divide by 100 since Chainlink returns 10 decimals and TRU is 8 decimals
     * @param amount Amount in USD
     * @return TRU value of USD input
     */
    function usdToTru(uint256 amount) external override view returns (uint256) {
        return amount.div(safeUint(chainlinkOracle.latestAnswer())).div(100);
    }

    /**
     * @dev converts from TRU with 8 decimals to USD with 18 decimals
     * Multiply by 100 since Chainlink returns 10 decimals and TRU is 8 decimals
     * @param amount Amount in TRU
     * @return USD value of TRU input
     */
    function truToUsd(uint256 amount) external override view returns (uint256) {
        return amount.mul(safeUint(chainlinkOracle.latestAnswer())).mul(100);
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
