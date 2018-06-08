pragma solidity ^0.4.23;

import "../DelegateBurnable.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";

contract DelegateBurnableMock is DelegateBurnable{

    function setBalanceSheet(address _balanceSheet) public returns(bool){
        Claimable balanceSheet = Claimable(_balanceSheet);
        balanceSheet.claimOwnership();
        return true;
    }

    function setAllowanceSheet(address _allowanceSheet) public returns(bool){
        Claimable allowanceSheet = Claimable(_allowanceSheet);
        allowanceSheet.claimOwnership();
        return true;
    }

    function delegateTotalSupply() public view returns (uint256){
      return 0;
    }
    function delegateBalanceOf(address who) public view returns (uint256){
      return 0;
    }
    function delegateTransfer(address to, uint256 value, address origSender) public returns (bool){
      return true;
    }
    function delegateAllowance(address owner, address spender) public view returns (uint256){
      return 0;
    }
    function delegateTransferFrom(address from, address to, uint256 value, address origSender) public returns (bool){
      return true;
    }
    function delegateApprove(address spender, uint256 value, address origSender) public returns (bool){
      return true;
    }
    function delegateIncreaseApproval(address spender, uint addedValue, address origSender) public returns (bool){
      return true;
    }
    function delegateDecreaseApproval(address spender, uint subtractedValue, address origSender) public returns (bool){
      return true;
    }
    function delegateBurn(address _origSender, uint256 _value, string _note) public{
    }
}
