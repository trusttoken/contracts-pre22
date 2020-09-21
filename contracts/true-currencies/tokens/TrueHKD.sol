// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithGasRefund} from "../TrueCurrencyWithGasRefund.sol";

/**
 * @title TrueHKD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueHKD is TrueCurrencyWithGasRefund {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public override pure returns (string memory) {
        return "TrueHKD";
    }

    function symbol() public override pure returns (string memory) {
        return "THKD";
    }
}
