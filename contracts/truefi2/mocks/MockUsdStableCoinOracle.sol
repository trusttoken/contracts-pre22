// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";

contract MockUsdStableCoinOracle {
    function tokenToUsd(uint256 tokenAmount) external pure returns (uint256) {
        return tokenAmount;
    }
}
