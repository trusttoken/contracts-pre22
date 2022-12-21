// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithProofOfReserve} from "../TrueCurrencyWithProofOfReserve.sol";

contract MockTrueCurrency is TrueCurrencyWithProofOfReserve {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }

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
