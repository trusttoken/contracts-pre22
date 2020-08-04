// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {HasOwner} from "../HasOwner.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// Fork of OpenZeppelin's BasicToken
/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract ModularBasicToken is HasOwner {
    using SafeMath for uint256;

    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev total number of tokens in existence
     */
    function totalSupply() public virtual view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address _who) public virtual view returns (uint256) {
        return _getBalance(_who);
    }

    function _getBalance(address _who) internal virtual view returns (uint256) {
        return _balanceOf[_who];
    }

    function _addBalance(address _who, uint256 _value) internal virtual returns (uint256 priorBalance) {
        priorBalance = _balanceOf[_who];
        _balanceOf[_who] = priorBalance.add(_value);
    }

    function _subBalance(address _who, uint256 _value) internal virtual returns (uint256 result) {
        result = _balanceOf[_who].sub(_value);
        _balanceOf[_who] = result;
    }

    function _setBalance(address _who, uint256 _value) internal virtual {
        _balanceOf[_who] = _value;
    }
}
