pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract WhiteList is Ownable {
    bytes32 public name;
    mapping (address => bool) public whiteList;

    function WhiteList(bytes32 _name) public {
        name = _name;
    }
    event ChangeWhiteList(address indexed to, bool canWithdraw);

    function changeWhiteList(address _to, bool _canWithdraw) onlyOwner public {
        whiteList[_to] = _canWithdraw;
        ChangeWhiteList(_to, _canWithdraw);
    }

    function hasAccess(address _address) public view returns (bool) {
        return whiteList[_address];
    }
}