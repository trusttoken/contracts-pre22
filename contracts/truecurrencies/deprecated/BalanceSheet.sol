// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {Claimable} from "./Claimable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// A wrapper around the balanceOf mapping.
contract BalanceSheet is Claimable {
    using SafeMath for uint256;

    mapping(address => uint256) public balanceOf;

    function addBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = balanceOf[_addr].add(_value);
    }

    function subBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = balanceOf[_addr].sub(_value);
    }

    function setBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = _value;
    }
}
