pragma solidity ^0.4.18;

import "../DelegateBurnable.sol";

contract FailingDelegate is DelegateBurnable {
    function delegateTotalSupply() public view returns (uint256) {
        return 0;
    }
    function delegateBalanceOf(address) public view returns (uint256) {
        return 0;
    }
    function delegateTransfer(address, uint256, address) public returns (bool) {
        return false;
    }
    function delegateAllowance(address, address) public view returns (uint256) {
        return 0;
    }
    function delegateTransferFrom(address, address, uint256, address) public returns (bool) {
        return false;
    }
    function delegateApprove(address, uint256, address) public returns (bool) {
        return false;
    }
    function delegateIncreaseApproval(address, uint, address) public returns (bool) {
        return false;
    }
    function delegateDecreaseApproval(address, uint, address) public returns (bool) {
        return false;
    }
    function delegateBurn(address, uint256) public {}
}

contract SucceedingDelegate is DelegateBurnable {
    function delegateTotalSupply() public view returns (uint256) {
        return 0;
    }
    function delegateBalanceOf(address) public view returns (uint256) {
        return 0;
    }
    function delegateTransfer(address, uint256, address) public returns (bool) {
        return true;
    }
    function delegateAllowance(address, address) public view returns (uint256) {
        return 0;
    }
    function delegateTransferFrom(address, address, uint256, address) public returns (bool) {
        return true;
    }
    function delegateApprove(address, uint256, address) public returns (bool) {
        return true;
    }
    function delegateIncreaseApproval(address, uint, address) public returns (bool) {
        return true;
    }
    function delegateDecreaseApproval(address, uint, address) public returns (bool) {
        return true;
    }
    function delegateBurn(address, uint256) public {}
}
