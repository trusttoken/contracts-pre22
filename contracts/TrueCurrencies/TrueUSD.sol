pragma solidity ^0.5.13;

import "./TrueRewardBackedToken.sol";
import "./DelegateERC20.sol";
import "./GasRefundToken.sol";


/** @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSD is TrueRewardBackedToken, DelegateERC20 {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string memory) {
        return "TUSD";
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurn";
    }

    // used by proxy to initialize
    // this sets the owner to msg.sender
    // may be a security risk for deployment
    function initialize() external {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }
}
