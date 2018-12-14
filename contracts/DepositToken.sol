pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

/** @title Deposit Token
Allows users to register their address so that all transfers to deposit addresses
of the registered address will be forwarded to the registered address.  
For example for address 0x9052BE99C9C8C5545743859e4559A751bDe4c923,
its deposit addresses are all addresses between
0x9052BE99C9C8C5545743859e4559A75100000 and 0x9052BE99C9C8C5545743859e4559A751fffff
Transfers to 0x9052BE99C9C8C5545743859e4559A75100005 will be forwared to 0x9052BE99C9C8C5545743859e4559A751bDe4c923
 */
contract DepositToken is ModularPausableToken {
    
    bytes32 public constant IS_DEPOSIT_ADDRESS = "isDepositAddress"; 

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        address shiftedAddress = address(uint(_to) >> 20);
        uint depositAddressValue = registry.getAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS);
        if (depositAddressValue != 0) {
            super._transferAllArgs(_from, _to, _value);
            super._transferAllArgs(_to, address(depositAddressValue), _value);
        } else {
            super._transferAllArgs(_from, _to, _value);
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        address shiftedAddress = address(uint(_to) >> 20);
        uint depositAddressValue = registry.getAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS);
        if (depositAddressValue != 0) {
            super.mint(_to, _value);
            super._transferAllArgs(_to, address(depositAddressValue), _value);
        } else {
            super.mint(_to, _value);
        }
    }
}
