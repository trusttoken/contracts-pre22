pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

/** @title Deposit Token
Allows users to register their address so that all transfers to deposit addresses
of the registered address will be forwarded to the registered address.  
For example for address 0x9052BE99C9C8C5545743859e4559A751bDe4c923,
its deposit addresses are all addresses between
0x9052BE99C9C8C5545743859e4559A75100000000 and 0x9052BE99C9C8C5545743859e4559A751ffffffff.
Transfers to 0x9052BE99C9C8C5545743859e4559A75100000005 will be forwared to 0x9052BE99C9C8C5545743859e4559A751bDe4c923.
 */
contract DepositToken is ModularPausableToken {
    
    bytes32 public constant IS_DEPOSIT_ADDRESS = "isDepositAddress"; 

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        address shiftedAddress = address(uint(_to) >> 24);
        uint value = registry.getAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS);
        if (value != 0) {
            super.transferAllArgs(_from, address(value), _value);
        } else {
            super.transferAllArgs(_from, _to, _value);
        }
    }
}
