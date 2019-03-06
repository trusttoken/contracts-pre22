pragma solidity ^0.4.23;

import "../HasOwner.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

// Version of OpenZeppelin's BasicToken whose balances mapping has been replaced
// with a separate BalanceSheet contract. remove the need to copy over balances.
/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract ModularBasicToken is HasOwner {
    using SafeMath for uint256;

    event BalanceSheetSet(address indexed sheet);
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
    * @dev claim ownership of the balancesheet contract
    * @param _sheet The address to of the balancesheet to claim.
    */
    function setBalanceSheet(address _sheet) public onlyOwner returns (bool) {
        balances = BalanceSheet(_sheet);
        balances.claimOwnership();
        emit BalanceSheetSet(_sheet);
        return true;
    }

    /**
    * @dev total number of tokens in existence
    */
    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address _who) public view returns (uint256) {
        return _getBalance(_who);
    }
    function _getBalance(address _who) internal view returns (uint256) {
        return _balanceOf[_who];
    }
    function _addBalance(address _who, uint256 _value) internal {
        _balanceOf[_who] = _balanceOf[_who].add(_value);
    }
    function _subBalance(address _who, uint256 _value) internal {
        _balanceOf[_who] = _balanceOf[_who].sub(_value);
    }
    function _setBalance(address _who, uint256 _value) internal {
        _balanceOf[_who] = _value;
    }
}
