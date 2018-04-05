pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Claimable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract BalanceSheet is Claimable {
    using SafeMath for uint256;

    mapping (address => uint256) public balanceOf;

    function addBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = balanceOf[addr].add(value);
    }

    function subBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = balanceOf[addr].sub(value);
    }

    function setBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = value;
    }
}
