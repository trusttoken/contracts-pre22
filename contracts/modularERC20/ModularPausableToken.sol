pragma solidity ^0.4.23;

import "./ModularMintableToken.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title Pausable token
 * @dev MintableToken modified with pausable transfers.
 **/
contract ModularPausableToken is ModularMintableToken, Pausable {

    function transferAllArgs(address _from, address _to, uint256 _value) internal whenNotPaused {
        super.transferAllArgs(_from, _to, _value);
    }

    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal whenNotPaused {
        super.transferFromAllArgs(_from, _to, _value, _spender);
    }

    function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal whenNotPaused {
        super.approveAllArgs(_spender, _value, _tokenHolder);
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal whenNotPaused {
        super.increaseApprovalAllArgs(_spender, _addedValue, _tokenHolder);
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal whenNotPaused {
        super.decreaseApprovalAllArgs(_spender, _subtractedValue, _tokenHolder);
    }

    function burnAllArgs(address _burner, uint256 _value, string _note) internal whenNotPaused {
        super.burnAllArgs(_burner, _value, _note);
    }
}
