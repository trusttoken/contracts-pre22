pragma solidity ^0.4.23;

import "./DelegateBurnable.sol";
import "./modularERC20/ModularPausableToken.sol";

/* Treats all delegate functions exactly like the corresponding normal functions,
e.g. delegateTransfer is just like transfer. See DelegateBurnable.sol for more on
the delegation system.
*/
contract StandardDelegate is DelegateBurnable, ModularPausableToken {
    address public delegatedFrom;

    event DelegatedFromSet(address addr);

    //only calls from appointed address will be processed
    //normally only calls from TrueUSD contract
    modifier onlySender(address _source) {
        require(msg.sender == _source, "message not from approved source");
        _;
    }

    //only calls from delegatedFrom can call the delegate___ functions
    //only calls from eventDelegate can call the emit ERC20 event functions
    function setDelegatedFrom(address _addr) public onlyOwner {
        delegatedFrom = _addr;
        eventDelegate = _addr;
        emit DelegatedFromSet(_addr);
    }

    // each function delegateX is simply forwarded to function X
    function delegateTotalSupply() public onlySender(delegatedFrom) view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address _who) public onlySender(delegatedFrom) view returns (uint256) {
        return balanceOf(_who);
    }

    function delegateTransfer(address _to, uint256 _value, address _origSender) public onlySender(delegatedFrom) returns (bool) {
        transferAllArgs(_origSender, _to, _value);
        return true;
    }

    function delegateAllowance(address _owner, address _spender) public onlySender(delegatedFrom) view returns (uint256) {
        return allowance(_owner, _spender);
    }

    function delegateTransferFrom(
        address _from,
        address _to,
        uint256 _value, 
        address _origSender) public onlySender(delegatedFrom) returns (bool) {
        transferFromAllArgs(_from, _to, _value, _origSender);
        return true;
    }

    function delegateApprove(address _spender, uint256 _value, address _origSender) public onlySender(delegatedFrom) returns (bool) {
        approveAllArgs(_spender, _value, _origSender);
        return true;
    }

    function delegateIncreaseApproval(
        address _spender, 
        uint256 _addedValue, 
        address _origSender) public onlySender(delegatedFrom) returns (bool) {
        increaseApprovalAllArgs(_spender, _addedValue, _origSender);
        return true;
    }

    function delegateDecreaseApproval(
        address _spender, 
        uint256 _subtractedValue, 
        address _origSender) public onlySender(delegatedFrom) returns (bool) {
        decreaseApprovalAllArgs(_spender, _subtractedValue, _origSender);
        return true;
    }

    function delegateBurn(address _origSender, uint256 _value, string _note) public onlySender(delegatedFrom) {
        burnAllArgs(_origSender, _value, _note);
    }
}
