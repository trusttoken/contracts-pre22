pragma solidity ^0.4.23;

import "./modularERC20/ModularMintableToken.sol";

/** @title Deposit Token
Allows users to register their address so that all transfers to deposit addresses
of the registered address will be forwarded to the registered address.  
For example for address 0x9052BE99C9C8C5545743859e4559A751bDe4c923,
its deposit addresses are all addresses between
0x9052BE99C9C8C5545743859e4559A75100000 and 0x9052BE99C9C8C5545743859e4559A751fffff
Transfers to 0x9052BE99C9C8C5545743859e4559A75100005 will be forwared to 0x9052BE99C9C8C5545743859e4559A751bDe4c923
 */
contract DepositToken is ModularMintableToken {
    
    bytes32 public constant IS_DEPOSIT_ADDRESS = "isDepositAddress"; 

}
