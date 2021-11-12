pragma solidity 0.6.10;

contract A {
    uint256 public a;
    string public name;

    function foo(string memory _name) public {
        name = _name;
    }
}