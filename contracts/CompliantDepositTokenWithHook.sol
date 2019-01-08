pragma solidity ^0.4.23;

import "./CompliantToken.sol";
import "./DepositToken.sol";
import "./TrueCoinReceiver.sol";

contract CompliantDepositTokenWithHook is CompliantToken, DepositToken {

    function transferFrom(address _to, uint256 _value, address _from) public returns (bool) {
        address _sender = msg.sender;
        bool isContract;
        (_to, isContract) = registry.requireCanTransferFrom(_sender, _from, _to);
        super._transferAllArgs(_from, _to, _value);
        if (isContract) {
            TrueCoinReceiver(_to).tokenFallback(_from, _value);
        }
        return true;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        address _from = msg.sender;
        bool isContract;
        (_to, isContract) = registry.requireCanTransfer(_from, _to);
        super._transferAllArgs(_from, _to, _value);
        if (isContract) {
            TrueCoinReceiver(_to).tokenFallback(_from, _value);
        }
        return true;
    }

}
