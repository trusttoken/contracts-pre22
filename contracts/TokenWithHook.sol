pragma solidity ^0.4.23;

import "./modularERC20/ModularMintableToken.sol";
import "./TrueCoinReceiver.sol";

/** @title Token With Hook
If tokens are transferred to a Registered Token Receiver contract, trigger the tokenFallback function in the 
Token Receiver contract. Assume all Registered Token Receiver contract implements the TrueCoinReceiver 
interface. If the tokenFallback reverts, the entire transaction reverts. 
 */
contract TokenWithHook is ModularMintableToken {
    
    bytes32 public constant IS_REGISTERED_CONTRACT = "isRegisteredContract"; 

}
