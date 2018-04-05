pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Claimable.sol";

contract AddressList is Claimable {
    string public name;
    mapping (address => bool) public onList;

    function AddressList(string _name) public {
        name = _name;
    }
    event ChangeWhiteList(address indexed to, bool onList);

    // Set whether _to is on the list or not. 0x0 is never on the list.
    function changeList(address _to, bool _onList) onlyOwner public {
        require(_to != 0x0);
        if (onList[_to] != _onList) {
            onList[_to] = _onList;
            emit ChangeWhiteList(_to, _onList);
        }
    }
}
