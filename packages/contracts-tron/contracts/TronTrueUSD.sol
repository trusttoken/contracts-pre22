// SPDX-License-Identifier: MIT
pragma solidity 0.6.0;

import {TrueCurrency} from "./common/TrueCurrency.sol";

/**
 * @title TrueUSD
 * @dev This is the top-level TRC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSD is TrueCurrency {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() public {
        require(!initialized, "already initialized");
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        burnMin = 1000000000000000000000;
        burnMax = 1000000000000000000000000000;
        initialized = true;
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public override pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public override pure returns (string memory) {
        return "TUSD";
    }
}