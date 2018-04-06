pragma solidity ^0.4.18;

import "./modularERC20/ModularBurnableToken.sol";
import "./DelegateBurnable.sol";
import "./modularERC20/ModularStandardToken.sol";

contract StandardDelegate is DelegateBurnable, ModularStandardToken, ModularBurnableToken {
    address public delegatedFrom;

    event DelegatedFromSet(address addr);

    modifier onlySender(address _source) {
        require(msg.sender == _source);
        _;
    }

    function setDelegatedFrom(address _addr) onlyOwner public {
        delegatedFrom = _addr;
        emit DelegatedFromSet(_addr);
    }

    // each function delegateX is simply forwarded to function X
    function delegateTotalSupply() onlySender(delegatedFrom) public view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address _who) onlySender(delegatedFrom) public view returns (uint256) {
        return balanceOf(_who);
    }

    function delegateTransferAllArgs(address _origSender, address _to, uint256 _value) onlySender(delegatedFrom) public {
        transferAllArgs(_origSender, _to, _value);
    }

    function delegateAllowance(address _owner, address _spender) onlySender(delegatedFrom) public view returns (uint256) {
        return allowance(_owner, _spender);
    }

    function delegateTransferFromAllArgs(address _from, address _to, uint256 _value, address _origSender) onlySender(delegatedFrom) public {
        transferFromAllArgs(_from, _to, _value, _origSender);
    }

    function delegateApproveAllArgs(address _spender, uint256 _value, address _origSender) onlySender(delegatedFrom) public {
        approveAllArgs(_spender, _value, _origSender);
    }

    function delegateIncreaseApprovalAllArgs(address _spender, uint256 _addedValue, address _origSender) onlySender(delegatedFrom) public {
        increaseApprovalAllArgs(_spender, _addedValue, _origSender);
    }

    function delegateDecreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _origSender) onlySender(delegatedFrom) public {
        decreaseApprovalAllArgs(_spender, _subtractedValue, _origSender);
    }

    function delegateBurnAllArgs(address _origSender, uint256 _value) onlySender(delegatedFrom) public {
        burnAllArgs(_origSender, _value);
    }
}
