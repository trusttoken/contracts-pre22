pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";
import "./GasRefundToken.sol";

/** @title TrueHKD
* @dev This is the top-level ERC20 contract, but most of the interesting functionality is
* inherited - see the documentation on the corresponding contracts.
*/
contract TrueHKD is 
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
        return "TrueHKD";
    }

    function symbol() public pure returns (string memory) {
        return "THKD";
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurnHKD";
    }
}
