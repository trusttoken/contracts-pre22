// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";
import {IUniswapPair} from "./interface/IUniswapPair.sol";

contract TruPriceUniswapOracle is ITruPriceOracle {
    using SafeMath for uint256;

    IUniswapPair public tusdEthPair;
    IUniswapPair public ethTruPair;

    constructor(IUniswapPair _tusdEthPair, IUniswapPair _ethTruPair) public {
        tusdEthPair = _tusdEthPair;
        ethTruPair = _ethTruPair;
    }

    function usdToTru(uint256 amount) external override view returns (uint256) {
        (uint256 tusdReserve, uint112 ethTusdReserve, ) = tusdEthPair.getReserves();
        (uint256 truReserve, uint112 ethTruReserve, ) = ethTruPair.getReserves();
        return amount.mul(ethTusdReserve).mul(truReserve).div(tusdReserve).div(ethTruReserve);
    }
}
