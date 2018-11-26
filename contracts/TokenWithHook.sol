pragma solidity ^0.4.24;

import "./modularERC20/ModularPausableToken.sol";
import "./TrueCoinReceiver"
/** @title Token With Hook
 */
contract TokenWithHook is ModularPausableToken {
    
    bytes32 public constant IS_REGISTERED_CONTRACT = "isRegisteredContract"; 

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        assembly { length := extcodesize(_to) }
        if (length > 0) {
            if(registry.getAttributeValue(_to, IS_REGISTERED_CONTRACT)) {
                super.transferAllArgs(_from, _to, _value);
                TrueCoinReceiver(_to).tokenFallback(msg.sender, _value);
            } else {
                super.transferAllArgs(_from, _to, _value);
            }
        } else {
            super.transferAllArgs(_from, _to, _value);
        }
    }
}
