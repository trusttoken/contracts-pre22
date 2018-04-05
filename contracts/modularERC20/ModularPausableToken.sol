pragma solidity ^0.4.18;

import "./ModularBurnableToken.sol";
import "./ModularStandardToken.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";

/**
 * @title Pausable token
 * @dev StandardToken modified with pausable transfers.
 **/
contract ModularPausableToken is ModularStandardToken, ModularBurnableToken, Pausable {
    function transferAllArgs(address from, address to, uint256 value) internal whenNotPaused {
        super.transferAllArgs(from, to, value);
    }

    function transferFromAllArgs(address from, address to, uint256 value, address spender) internal whenNotPaused {
        super.transferFromAllArgs(from, to, value, spender);
    }

    function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal whenNotPaused {
        super.approveAllArgs(_spender, _value, _tokenHolder);
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address tokenHolder) internal whenNotPaused {
        super.increaseApprovalAllArgs(_spender, _addedValue, tokenHolder);
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address tokenHolder) internal whenNotPaused {
        super.decreaseApprovalAllArgs(_spender, _subtractedValue, tokenHolder);
    }

    function burnAllArgs(address burner, uint256 value) internal whenNotPaused {
        super.burnAllArgs(burner, value);
    }
}
