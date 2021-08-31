// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";

contract MockUsdStableCoinOracle {
    uint256 decimalAdjustment;

    function tokenToUsd(uint256 tokenAmount) external view returns (uint256) {
        return tokenAmount * (10**decimalAdjustment);
    }

    function setDecimalAdjustment(uint256 adjustment) external {
        decimalAdjustment = adjustment;
    }
}
