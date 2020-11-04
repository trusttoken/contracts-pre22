// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../common/ERC20.sol";

interface IDelegateERC20 {
    function delegateTotalSupply() external view returns (uint256);

    function delegateBalanceOf(address who) external view returns (uint256);

    function delegateTransfer(
        address to,
        uint256 value,
        address origSender
    ) external returns (bool);

    function delegateAllowance(address owner, address spender) external view returns (uint256);

    function delegateTransferFrom(
        address from,
        address to,
        uint256 value,
        address origSender
    ) external returns (bool);

    function delegateApprove(
        address spender,
        uint256 value,
        address origSender
    ) external returns (bool);

    function delegateIncreaseApproval(
        address spender,
        uint256 addedValue,
        address origSender
    ) external returns (bool);

    function delegateDecreaseApproval(
        address spender,
        uint256 subtractedValue,
        address origSender
    ) external returns (bool);
}

/**
 * Mock Legacy TUSD contract. Forwards calls to delegate ERC20 contract
 */
contract MockDelegateERC20 is ERC20 {
    // If this contract needs to be upgraded, the new contract will be stored
    // in 'delegate' and any ERC20 calls to this contract will be delegated to that one.
    IDelegateERC20 public delegate;

    event DelegatedTo(address indexed newContract);

    // Can undelegate by passing in newContract = address(0)
    function delegateToNewContract(IDelegateERC20 newContract) public {
        delegate = newContract;
        emit DelegatedTo(address(delegate));
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public virtual override pure returns (string memory) {
        return "DelegateERC20";
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public virtual override pure returns (string memory) {
        return "DERC20";
    }

    // If a delegate has been designated, all ERC20 calls are forwarded to it
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        if (address(delegate) == address(0)) {
            return super.transfer(to, value);
        } else {
            return delegate.delegateTransfer(to, value, msg.sender);
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public virtual override returns (bool) {
        if (address(delegate) == address(0)) {
            return super.transferFrom(from, to, value);
        } else {
            return delegate.delegateTransferFrom(from, to, value, msg.sender);
        }
    }

    function balanceOf(address who) public override view returns (uint256) {
        if (address(delegate) == address(0)) {
            return super.balanceOf(who);
        } else {
            return delegate.delegateBalanceOf(who);
        }
    }

    function approve(address spender, uint256 value) public virtual override returns (bool) {
        if (address(delegate) == address(0)) {
            return super.approve(spender, value);
        } else {
            return delegate.delegateApprove(spender, value, msg.sender);
        }
    }

    function allowance(address _owner, address spender) public virtual override view returns (uint256) {
        if (address(delegate) == address(0)) {
            return super.allowance(_owner, spender);
        } else {
            return delegate.delegateAllowance(_owner, spender);
        }
    }

    function totalSupply() public override view returns (uint256) {
        if (address(delegate) == address(0)) {
            return super.totalSupply();
        } else {
            return delegate.delegateTotalSupply();
        }
    }

    function increaseApproval(address spender, uint256 addedValue) public returns (bool) {
        if (address(delegate) == address(0)) {
            return super.increaseAllowance(spender, addedValue);
        } else {
            return delegate.delegateIncreaseApproval(spender, addedValue, msg.sender);
        }
    }

    function decreaseApproval(address spender, uint256 subtractedValue) public returns (bool) {
        if (address(delegate) == address(0)) {
            return super.decreaseAllowance(spender, subtractedValue);
        } else {
            return delegate.delegateDecreaseApproval(spender, subtractedValue, msg.sender);
        }
    }
}
