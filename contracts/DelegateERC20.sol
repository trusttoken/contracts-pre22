import "./modularERC20/ModularStandardToken.sol";

contract DelegateERC20 is ModularStandardToken {
  function delegateTotalSupply() public view returns (uint256) {
    return totalSupply();
  }
  function delegateBalanceOf(address who) public view returns (uint256) {
    return balanceOf(who);
  }
  function delegateTransfer(address to, uint256 value, address origSender) public returns (bool) {
    require(msg.sender == 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E);
    transferAllArgs(origSender, to, value);
    return true;
  }
  function delegateAllowance(address owner, address spender) public view returns (uint256) {
    return allowance(owner, spender);
  }
  function delegateTransferFrom(address from, address to, uint256 value, address origSender) public returns (bool) {
    require(msg.sender == 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E);
    transferFromAllArgs(from, to, value, origSender);
    return true;
  }
  function delegateApprove(address spender, uint256 value, address origSender) public returns (bool) {
    require(msg.sender == 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E);
    approveAllArgs(spender, value, origSender);
    return true;
  }
  function delegateIncreaseApproval(address spender, uint addedValue, address origSender) public returns (bool) {
    require(msg.sender == 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E);
    increaseApprovalAllArgs(spender, addedValue, origSender);
    return true;
  }
  function delegateDecreaseApproval(address spender, uint subtractedValue, address origSender) public returns (bool) {
    require(msg.sender == 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E);
    decreaseApprovalAllArgs(spender, subtractedValue, origSender);
    return true;
  }
}
