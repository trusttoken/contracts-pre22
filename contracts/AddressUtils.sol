pragma solidity ^0.4.23;

library AddressUtils {
     function shortenAddress(address addr)  pure internal returns (address){
        bytes20 bytes20Address = cut(bytes32(uint256(addr) << 96));
        return address(bytes20Address);
    }


  function cut(bytes32 sha) pure internal returns (bytes10 halfOfAddress) {
    assembly {
      let freemem_pointer := mload(0x40)
      mstore(add(freemem_pointer,0x00), sha)
      halfOfAddress := mload(add(freemem_pointer,0x00))
    }
  }
}