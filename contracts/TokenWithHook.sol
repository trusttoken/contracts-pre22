pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";
import "./TrueCoinReceiver.sol";

/** @title Token With Hook
If tokens are transferred to a Registered Token Receiver contract, trigger the tokenFallback function in the 
Token Receiver contract. Assume all Registered Token Receiver contract implements the TrueCoinReceiver 
interface. If the tokenFallback reverts, the entire transaction reverts. 
 */
contract TokenWithHook is ModularPausableToken {
    
    bytes32 public constant IS_REGISTERED_CONTRACT = "isRegisteredContract"; 

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        uint length;
        assembly { length := extcodesize(_to) }

        if (length > 0) {
            super.transferAllArgs(_from, _to, _value);
            if(registry.hasAttribute(_to, IS_REGISTERED_CONTRACT)) {
                TrueCoinReceiver(_to).tokenFallback(_from, _value);
            }
        } else {
            super.transferAllArgs(_from, _to, _value);
        }
    }
}
