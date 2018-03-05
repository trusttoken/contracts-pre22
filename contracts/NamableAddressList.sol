pragma solidity ^0.4.18;

import "./AddressList.sol";

contract NamableAddressList is AddressList {
    function NamableAddressList(string _name, bool nullValue)
        AddressList(_name, nullValue) public {}

    function changeName(string _name) onlyOwner public {
        name = _name;
    }
}
