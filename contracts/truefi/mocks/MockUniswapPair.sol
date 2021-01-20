// SPDX-License-Identifier: MIT
pragma solidity ^0.6.10;

import {IUniswapPair} from "../interface/IUniswapPair.sol";


contract MockUniswapPair is IUniswapPair {
    uint256 price = 1e18;

    function setPrice(uint256 newPrice) external {
        price = newPrice;
    }

    function price0CumulativeLast() external view override returns (uint256) {
        return price;
    }
}
