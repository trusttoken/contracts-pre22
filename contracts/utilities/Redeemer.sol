pragma solidity ^0.4.23;

import "./DepositAddressRegistrar.sol";
import "./FallbackRegistrar.sol";
import "../HasOwner.sol";
import "../TrueCoinReceiver.sol";
import "../CompliantDepositTokenWithHook.sol";

contract Redeemer is TrueCoinReceiver, HasOwner {
    FallbackRegistrar public constant fallbackRegistrar = FallbackRegistrar(0x1); // TODO set
    DepositAddressRegistrar public constant autosweepRegistrar = DepositAddressRegistrar(0x00000000000Da14C27C155Bb7C1Ac9Bd7519eB3b);

    address redemptionAddress;

    constructor(address _redemptionAddress) public {
        require(fallbackRegistrar.call());
        require(autosweepRegistrar.call());
        redemptionAddress = _redemptionAddress;
    }

    function tokenFallback(address from, uint256 value) external {
        CompliantDepositTokenWithHook(msg.sender).transfer(redemptionAddress, value);
    }

    function setRedemptionAddress(address _redemptionAddress) onlyOwner {
        redemptionAddress = _redemptionAddress;
    }
}
