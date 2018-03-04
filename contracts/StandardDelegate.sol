pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";
import "./DelegateERC20.sol";

contract StandardDelegate is StandardToken, DelegateERC20 {
    address public delegatedFrom;

    modifier onlySender(address source) {
        require(msg.sender == source);
        _;
    }

    function setDelegatedFrom(address addr) onlyOwner public {
        delegatedFrom = addr;
    }

    // All delegate ERC20 functions are forwarded to corresponding normal functions
    function delegateTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address who) public view returns (uint256) {
        return balanceOf(who);
    }

    function delegateTransfer(address to, uint256 value, address origSender) onlySender(delegatedFrom) public returns (bool) {
        transferAllArgsNoAllowance(origSender, to, value);
        return true;
    }

    function delegateAllowance(address owner, address spender) public view returns (uint256) {
        return allowance(owner, spender);
    }

    function delegateTransferFrom(address from, address to, uint256 value, address origSender) onlySender(delegatedFrom) public returns (bool) {
        transferAllArgsYesAllowance(from, to, value, origSender);
        return true;
    }

    function delegateApprove(address spender, uint256 value, address origSender) onlySender(delegatedFrom) public returns (bool) {
        approveAllArgs(spender, value, origSender);
        return true;
    }

    function delegateIncreaseApproval(address spender, uint addedValue, address origSender) onlySender(delegatedFrom) public returns (bool) {
        increaseApprovalAllArgs(spender, addedValue, origSender);
        return true;
    }

    function delegateDecreaseApproval(address spender, uint subtractedValue, address origSender) onlySender(delegatedFrom) public returns (bool) {
        decreaseApprovalAllArgs(spender, subtractedValue, origSender);
        return true;
    }
}
