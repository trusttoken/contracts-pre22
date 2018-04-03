pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "./DelegateBurnable.sol";

contract CanDelegate is StandardToken, BurnableToken {
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
    function transfer(address to, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.transfer(to, value);
        } else {
            return delegate.delegateTransfer(to, value, msg.sender);
        }
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.transferFrom(from, to, value);
        } else {
            return delegate.delegateTransferFrom(from, to, value, msg.sender);
        }
    }

    function balanceOf(address who) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.balanceOf(who);
        } else {
            return delegate.delegateBalanceOf(who);
        }
    }

    function approve(address spender, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.approve(spender, value);
        } else {
            return delegate.delegateApprove(spender, value, msg.sender);
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

    function increaseApproval(address spender, uint addedValue) public returns (bool) {
        if (delegate == address(0)) {
            return super.increaseApproval(spender, addedValue);
        } else {
            return delegate.delegateIncreaseApproval(spender, addedValue, msg.sender);
        }
    }

    function decreaseApproval(address spender, uint subtractedValue) public returns (bool) {
        if (delegate == address(0)) {
            return super.decreaseApproval(spender, subtractedValue);
        } else {
            return delegate.delegateDecreaseApproval(spender, subtractedValue, msg.sender);
        }
    }

    function burn(uint256 value) public {
        if (delegate == address(0)) {
            super.burn(value);
        } else {
            delegate.delegateBurn(value, msg.sender);
        }
    }
}
