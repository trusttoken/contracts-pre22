// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import {TrueCurrency} from "../common/TrueCurrency.sol";

contract MockTrueCurrency is TrueCurrency {
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
        return "TrueCurrency";
    }

    function symbol() public pure override returns (string memory) {
        return "TCUR";
    }
}
