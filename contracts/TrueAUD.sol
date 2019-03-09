pragma solidity ^0.4.23;

import "./CompliantDepositTokenWithHook.sol";
import "./GasRefundToken.sol";

/** @title TrueAUD
* @dev This is the top-level ERC20 contract, but most of the interesting functionality is
* inherited - see the documentation on the corresponding contracts.
*/
contract TrueAUD is 
CompliantDepositTokenWithHook,
GasRefundToken {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string) {
        return "TrueAUD";
    }

    function symbol() public pure returns (string) {
        return "TAUD";
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurnAUD";
    }
}

