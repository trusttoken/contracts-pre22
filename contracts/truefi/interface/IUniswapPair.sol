// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IUniswapPair {
    function price0CumulativeLast() external view returns (uint256);
}
