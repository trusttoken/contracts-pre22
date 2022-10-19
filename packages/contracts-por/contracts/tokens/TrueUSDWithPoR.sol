// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithPoR} from "../TrueCurrencyWithPoR.sol";
import {ITrueCurrency} from "../interface/ITrueCurrency.sol";

/**
 * @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSDWithPoR is TrueCurrencyWithPoR {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure override returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure override returns (string memory) {
        return "TUSD";
    }
}
