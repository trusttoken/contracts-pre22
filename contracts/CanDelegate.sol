pragma solidity ^0.4.23;

import "./DelegateBurnable.sol";
import "./modularERC20/ModularPausableToken.sol";

// See DelegateBurnable.sol for more on the delegation system.
contract CanDelegate is ModularPausableToken {
    // If this contract needs to be upgraded, the new contract will be stored
    // in 'delegate' and any BurnableToken calls to this contract will be delegated to that one.
    DelegateBurnable public delegate;

    event DelegateToNewContract(address indexed newContract);

    // Can undelegate by passing in newContract = address(0)
    function delegateToNewContract(DelegateBurnable _newContract) public onlyOwner {
        delegate = _newContract;
        emit DelegateToNewContract(delegate);
    }

    // If a delegate has been designated, all ERC20 calls are forwarded to it
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        if (delegate == address(0)) {
            super.transferAllArgs(_from, _to, _value);
        } else {
            require(delegate.delegateTransfer(_to, _value, _from));
        }
    }

    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        if (delegate == address(0)) {
            super.transferFromAllArgs(_from, _to, _value, _spender);
        } else {
            require(delegate.delegateTransferFrom(_from, _to, _value, _spender));
        }
    }

    function balanceOf(address who) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.balanceOf(who);
        } else {
            return delegate.delegateBalanceOf(who);
        }
    }

    function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal {
        if (delegate == address(0)) {
            super.approveAllArgs(_spender, _value, _tokenHolder);
        } else {
            require(delegate.delegateApprove(_spender, _value, _tokenHolder));
        }
    }

    function allowance(address _owner, address _spender) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.allowance(_owner, _spender);
        } else {
            return delegate.delegateAllowance(_owner, _spender);
        }
    }

    function totalSupply() public view returns (uint256) {
        if (delegate == address(0)) {
            return super.totalSupply();
        } else {
            return delegate.delegateTotalSupply();
        }
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal {
        if (delegate == address(0)) {
            super.increaseApprovalAllArgs(_spender, _addedValue, _tokenHolder);
        } else {
            require(delegate.delegateIncreaseApproval(_spender, _addedValue, _tokenHolder));
        }
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal {
        if (delegate == address(0)) {
            super.decreaseApprovalAllArgs(_spender, _subtractedValue, _tokenHolder);
        } else {
            require(delegate.delegateDecreaseApproval(_spender, _subtractedValue, _tokenHolder));
        }
    }

    function burnAllArgs(address _burner, uint256 _value, string _note) internal {
        if (delegate == address(0)) {
            super.burnAllArgs(_burner, _value, _note);
        } else {
            delegate.delegateBurn(_burner, _value ,_note);
        }
    }
}
