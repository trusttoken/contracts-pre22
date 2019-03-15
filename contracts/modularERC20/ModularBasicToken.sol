pragma solidity ^0.4.23;

import "../HasOwner.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

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
    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address _who) public view returns (uint256) {
        return _getBalance(_who);
    }
    function _getBalance(address _who) internal view returns (uint256 outBalance) {
        bytes32 storageLocation = keccak256(_who);
        assembly {
            outBalance := sload(storageLocation)
        }
    }
    function _addBalance(address _who, uint256 _value) internal returns (uint256 priorBalance) {
        bytes32 storageLocation = keccak256(_who);
        assembly {
            priorBalance := sload(storageLocation)
        }
        uint256 result = priorBalance.add(_value);
        assembly {
            sstore(storageLocation, result)
        }
    }
    function _subBalance(address _who, uint256 _value) internal returns (uint256 result) {
        bytes32 storageLocation = keccak256(_who);
        uint256 priorBalance;
        assembly {
            priorBalance := sload(storageLocation)
        }
        result = priorBalance.sub(_value);
        assembly {
            sstore(storageLocation, result)
        }
    }
    function _setBalance(address _who, uint256 _value) internal {
        bytes32 storageLocation = keccak256(_who);
        assembly {
            sstore(storageLocation, _value)
        }
    }
}
