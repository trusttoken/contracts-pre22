pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";
import "./GasRefundToken.sol";

/** @title TrueAUD
* @dev This is the top-level ERC20 contract, but most of the interesting functionality is
* inherited - see the documentation on the corresponding contracts.
*/
contract TrueAUD is 
CompliantDepositTokenWithHook {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string memory) {
        return "TrueAUD";
    }

    function symbol() public pure returns (string memory) {
        return "TAUD";
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurnAUD";
    }
}

