// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithProofOfReserve} from "./common/TrueCurrencyWithProofOfReserve.sol";

/**
 * @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract BscTrueUSD is TrueCurrencyWithProofOfReserve {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() public {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        burnMin = 1_000_000_000_000_000_000_000; // 1 K
        burnMax = 1_000_000_000_000_000_000_000_000_000; // 1 B
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
