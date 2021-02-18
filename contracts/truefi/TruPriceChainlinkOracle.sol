// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";
import {IUniswapPair} from "./interface/IUniswapPair.sol";

interface IChainLink {
    function latestAnswer() external view returns (int256);
}

contract TruPriceChainLinkOracle is ITruPriceOracle {
    using SafeMath for uint256;

    IChainLink public chainlinkOracle;

    constructor(IChainLink _chainlinkOracle) public {
        chainlinkOracle = _chainlinkOracle;
    }

    /**
     * @dev converts from USD with 18 decimals to TRU with 8 decimals
     */
    function usdToTru(uint256 amount) external override view returns (uint256) {
        return amount.div(safeUint(chainlinkOracle.latestAnswer())).div(100);
    }

    /**
     * @dev converts from TRU with 8 decimals to USD with 18 decimals
     */
    function truToUsd(uint256 amount) external override view returns (uint256) {
        return amount.mul(safeUint(chainlinkOracle.latestAnswer())).mul(100);
    }

    function safeUint(int256 value) internal pure returns (uint256) {
        require(value >= 0, "TruPriceChainLinkOracle: uint underflow");
        return uint256(value);
    }
}
