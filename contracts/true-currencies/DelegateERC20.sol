// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrency} from "./TrueCurrency.sol";

/**
 * @title DelegateERC20
 * Accept forwarding delegation calls from the old TrueUSD (V1) contract.
 * This way the all the ERC20 functions in the old contract still works
 * (except Burn).
 *
 * The original contract is at 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E.
 * Lines 497-574 on-chain call these delegate functions to forward calls
 * This gives the delegate contract the power to change the state of the TrueUSD
 * contract. The owner of this contract is the TrueUSD TokenController
 * at 0x0000000000075efbee23fe2de1bd0b7690883cc9.
 *
 * Our audits for TrueCurrency can be found here: github.com/trusttoken/audits
 */
abstract contract DelegateERC20 is TrueCurrency {
    // require msg.sender is the delegate smart contract
    modifier onlyDelegateFrom() {
        revert("DelegateERC20: TrueUSD (V1) is not supported");
        _;
    }

    /**
     * @dev Delegate call to get total supply
     * @return Total supply
     */
    function delegateTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    /**
     * @dev Delegate call to get balance
     * @param who Address to get balance for
     * @return balance of account
     */
    function delegateBalanceOf(address who) public view returns (uint256) {
        return balanceOf(who);
    }

    /**
     * @dev Delegate call to transfer
     * @param to address to transfer to
     * @param value amount to transfer
     * @param origSender original msg.sender on delegate contract
     * @return success
     */
    function delegateTransfer(
        address to,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        _transfer(origSender, to, value);
        return true;
    }

    /**
     * @dev Delegate call to get allowance
     * @param owner account owner
     * @param spender account to check allowance for
     * @return allowance
     */
    function delegateAllowance(address owner, address spender) public view returns (uint256) {
        return allowance(owner, spender);
    }

    /**
     * @dev Delegate call to transfer from
     * @param from account to transfer funds from
     * @param to account to transfer funds to
     * @param value value to transfer
     * @param origSender original msg.sender on delegate contract
     * @return success
     */
    function delegateTransferFrom(
        address from,
        address to,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        // ERC20 transferFrom with _msgSender() replaced by origSender
        _transfer(from, to, value);
        _approve(from, origSender, _allowances[from][origSender].sub(value, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev Delegate call to approve
     * @param spender account to approve for
     * @param value amount to approve
     * @param origSender original msg.sender on delegate contract
     * @return success
     */
    function delegateApprove(
        address spender,
        uint256 value,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        _approve(origSender, spender, value);
        return true;
    }

    /**
     * @dev Delegate call to increase approval
     * @param spender account to increase approval for
     * @param addedValue amount of approval to add
     * @param origSender original msg.sender on delegate contract
     * @return success
     */
    function delegateIncreaseApproval(
        address spender,
        uint256 addedValue,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        // ERC20 increaseAllowance() with _msgSender() replaced by origSender
        _approve(origSender, spender, _allowances[origSender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Delegate call to decrease approval
     * @param spender spender to decrease approval for
     * @param subtractedValue value to subtract from approval
     * @param origSender original msg.sender on delegate contract
     * @return success
     */
    function delegateDecreaseApproval(
        address spender,
        uint256 subtractedValue,
        address origSender
    ) public onlyDelegateFrom returns (bool) {
        // ERC20 decreaseAllowance() with _msgSender() replaced by origSender
        _approve(origSender, spender, _allowances[origSender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }
}
