pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

/*
Allows users to register their address so that all transfers to deposit addresses
of the registered address will be forwarded to the registered address.  
For example for address 0x9052BE99C9C8C5545743859e4559A751bDe4c923,
the its deposit addresses are all addresses between
0x9052BE99C9C8C5545743859e4559A75100000000 and 0x9052BE99C9C8C5545743859e4559A751ffffffff
Transfers to 0x9052BE99C9C8C5545743859e4559A75100000005 will be forwared to 0x9052BE99C9C8C5545743859e4559A751bDe4c923
 */
contract DepositToken is ModularPausableToken {
    
    string public constant IS_DEPOSIT_ADDRESS = "isDepositAddress"; 

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        uint value;
        bytes32 notes;
        address admin;
        uint time;
        (value, notes, admin, time) = registry.getAttribute(maskedAddress(_to), IS_DEPOSIT_ADDRESS);
        if (value != 0) {
            super.transferAllArgs(_from, address(value), _value);
        } else {
            super.transferAllArgs(_from, _to, _value);
        }
    }

    /**
    @dev returns the address with last 8 characters zeroed out
    */
    function maskedAddress(address _addr) public constant returns (address) {
        bytes20 bytes20Address = cut(uint256(_addr) << 96);
        return address(bytes20Address);
    }

    function cut(uint shiftedAddress) internal constant returns (bytes16 shortAddress) {
        assembly {
            shortAddress := shiftedAddress
        }
    }
}
