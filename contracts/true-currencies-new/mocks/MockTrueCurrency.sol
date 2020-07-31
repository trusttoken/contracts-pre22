// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {TrueCurrency} from "../TrueCurrency.sol";

/** @title TrueCAD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract MockTrueCurrency is TrueCurrency {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public override pure returns (string memory) {
        return "TrueCurrency";
    }

    function symbol() public override pure returns (string memory) {
        return "TMONEY";
    }
}
