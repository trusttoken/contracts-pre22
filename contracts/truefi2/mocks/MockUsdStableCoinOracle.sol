// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";

contract MockUsdStableCoinOracle {
    uint256 decimalAdjustment;

    function tokenToUsd(uint256 tokenAmount) external view returns (uint256) {
        return tokenAmount * (10**decimalAdjustment);
    }

    function tokenToTru(uint256 tokenAmount) external view returns (uint256) {
        return (tokenAmount * 4 * 10**8) / 10**(18 - decimalAdjustment);
    }

    function truToToken(uint256 truAmount) external view returns (uint256) {
        return (truAmount * 1e10) / 4 / 10**decimalAdjustment;
    }

    function truToUsd(uint256 truAmount) external pure returns (uint256) {
        return (truAmount * 1e10) / 4;
    }

    function setDecimalAdjustment(uint256 adjustment) external {
        decimalAdjustment = adjustment;
    }
}
