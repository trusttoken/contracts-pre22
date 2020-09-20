// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {CompliantDepositTokenWithHook} from "./CompliantDepositTokenWithHook.sol";

/** 
 * @title DelegateERC20
 * Accept forwarding delegation calls from the old TrueUSD (V1) contract. 
 * This way the all the ERC20 functions in the old contract still works 
 * (except Burn).
*/
abstract contract DelegateERC20 is ERC20 {
    address constant DELEGATE_FROM = 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E;

    modifier onlyDelegateFrom() virtual {
        require(msg.sender == DELEGATE_FROM);
        _;
    }

    function delegateTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address who) public view returns (uint256) {
        return balanceOf(who);
    }

    function delegateTransfer(
        address to,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        return _transfer(origSender, to, value);
    }

    function delegateAllowance(address owner, address spender) public view returns (uint256) {
        return allowance(owner, spender);
    }

    function delegateTransferFrom(
        address from,
        address to,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        return transferFrom(from, to, value, origSender);
    }

    function delegateApprove(
        address spender,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        return _approve(spender, value, origSender);
    }

    function delegateIncreaseApproval(
        address spender,
        uint256 addedValue,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        return increaseAllowance(spender, addedValue, origSender);
    }

    function delegateDecreaseApproval(
        address spender,
        uint256 subtractedValue,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        return decreaseAllowance(spender, subtractedValue, origSender);
    }
}
