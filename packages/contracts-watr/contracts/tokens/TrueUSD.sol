// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithProofOfReserve} from "../TrueCurrencyWithProofOfReserve.sol";

/**
 * @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSD is TrueCurrencyWithProofOfReserve {
    uint8 constant ROUNDING = 2;

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
