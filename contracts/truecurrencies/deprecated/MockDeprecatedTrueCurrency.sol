// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {CompliantDepositTokenWithHook} from "../CompliantDepositTokenWithHook.sol";

/** @title TrueCAD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract MockDeprecatedTrueCurrency is CompliantDepositTokenWithHook {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string memory) {
        return "OldTrueCurrency";
    }

    function symbol() public pure returns (string memory) {
        return "TCUR-OLD";
    }

    function canBurn() internal override pure returns (bytes32) {
        return "canBurn";
    }
}
