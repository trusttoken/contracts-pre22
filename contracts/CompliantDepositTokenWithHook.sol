pragma solidity ^0.4.23;

import "./CompliantToken.sol";
import "./DepositToken.sol";
import "./TrueCoinReceiver.sol";

contract CompliantDepositTokenWithHook is CompliantToken, DepositToken {

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal {
        bool isContract;
        (_to, isContract) = registry.requireCanTransferFrom(_sender, _from, _to);
        super._transferAllArgs(_from, _to, _value);
        allowances.subAllowance(_from, _sender, _value);
        if (isContract) {
            TrueCoinReceiver(_to).tokenFallback(_from, _value);
        }
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool isContract;
        (_to, isContract) = registry.requireCanTransfer(_from, _to);
        super._transferAllArgs(_from, _to, _value);
        if (isContract) {
            TrueCoinReceiver(_to).tokenFallback(_from, _value);
        }
    }

}
