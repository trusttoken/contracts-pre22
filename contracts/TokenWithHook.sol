pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";
import "./TrueCoinReceiver.sol";

/** @title Token With Hook
 */
contract TokenWithHook is ModularPausableToken {
    
    bytes32 public constant IS_REGISTERED_CONTRACT = "isRegisteredContract"; 

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        uint length;
        assembly { length := extcodesize(_to) }

        if (length > 0) {
            if(registry.hasAttribute(_to, IS_REGISTERED_CONTRACT)) {
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
