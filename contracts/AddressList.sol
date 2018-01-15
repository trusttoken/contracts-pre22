pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract AddressList is Ownable {
    bytes32 public name;
    mapping (address => bool) public onList;

    function AddressList(bytes32 _name) public {
        name = _name;
    }
    event ChangeWhiteList(address indexed to, bool onList);

    function changeList(address _to, bool _onList) onlyOwner public {
        onList[_to] = _onList;
        ChangeWhiteList(_to, _onList);
    }
}
