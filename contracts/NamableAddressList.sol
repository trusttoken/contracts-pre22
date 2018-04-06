pragma solidity ^0.4.18;

import "./AddressList.sol";

contract NamableAddressList is AddressList {
    event ChangeName(string name);

    function NamableAddressList(string _name) AddressList(_name) public {}

    function changeName(string _name) onlyOwner public {
        name = _name;
        emit ChangeName(_name);
    }
}
