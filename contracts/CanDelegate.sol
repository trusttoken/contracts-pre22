pragma solidity ^0.4.18;

import "./DelegateBurnable.sol";
import "./GatedToken.sol";

contract CanDelegate is GatedToken {
    // If this contract needs to be upgraded, the new contract will be stored
    // in 'delegate' and any BurnableToken calls to this contract will be delegated to that one.
    DelegateBurnable public delegate;

    event DelegatedTo(address indexed newContract);

    // Can undelegate by passing in newContract = address(0)
    function delegateToNewContract(DelegateBurnable newContract) public onlyOwner {
        delegate = newContract;
        DelegatedTo(delegate);
    }

    // If a delegate has been designated, all ERC20 calls are forwarded to it
    function transferAllArgs(address from, address to, uint256 value) internal {
        if (delegate == address(0)) {
            super.transferAllArgs(from, to, value);
        } else {
            delegate.delegateTransferAllArgs(from, to, value);
        }
    }

    function transferFromAllArgs(address from, address to, uint256 value, address spender) internal {
        if (delegate == address(0)) {
            super.transferFromAllArgs(from, to, value, spender);
        } else {
            delegate.delegateTransferFromAllArgs(from, to, value, spender);
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
            delegate.delegateApproveAllArgs(_spender, _value, _tokenHolder);
        }
    }

    function allowance(address _owner, address spender) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.allowance(_owner, spender);
        } else {
            return delegate.delegateAllowance(_owner, spender);
        }
    }

    function totalSupply() public view returns (uint256) {
        if (delegate == address(0)) {
            return super.totalSupply();
        } else {
            return delegate.delegateTotalSupply();
        }
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address tokenHolder) internal {
        if (delegate == address(0)) {
            super.increaseApprovalAllArgs(_spender, _addedValue, tokenHolder);
        } else {
            delegate.delegateIncreaseApprovalAllArgs(_spender, _addedValue, tokenHolder);
        }
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address tokenHolder) internal {
        if (delegate == address(0)) {
            super.decreaseApprovalAllArgs(_spender, _subtractedValue, tokenHolder);
        } else {
            delegate.delegateDecreaseApprovalAllArgs(_spender, _subtractedValue, tokenHolder);
        }
    }

    function burnAllArgs(address burner, uint256 value) internal {
        if (delegate == address(0)) {
            super.burnAllArgs(burner, value);
        } else {
            delegate.delegateBurnAllArgs(burner, value);
        }
    }
}
