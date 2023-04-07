// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithProofOfReserve} from "../TrueCurrencyWithProofOfReserve.sol";

contract MockTrueCurrency is TrueCurrencyWithProofOfReserve {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public view override returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure override returns (string memory) {
        return "TrueCurrency";
    }

    function symbol() public pure override returns (string memory) {
        return "TCUR";
    }
}
