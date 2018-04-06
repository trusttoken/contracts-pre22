pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Claimable.sol";

contract AddressList is Claimable {
    string public name;
    mapping (address => bool) public onList;

    function AddressList(string _name) public {
        name = _name;
    }
    event ListChanged(address indexed addr, bool value);

    // Set whether _to is on the list or not. address(0) is never on the list.
    function changeList(address _addr, bool _value) onlyOwner public {
        require(_addr != address(0));
        if (onList[_addr] != _value) {
            onList[_addr] = _value;
            emit ListChanged(_addr, _value);
        }
    }
}
