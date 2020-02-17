pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./CErc20Interface.sol";

contract MockCErc20 is CErc20Interface {
  IERC20 public token;
  mapping (address => uint256) public balance;

  constructor(
    IERC20 _token
  ) public {
    token = _token;
  }

  function mint(uint mintAmount) external returns (uint) {
    require(token.allowance(msg.sender, address(this)) < mintAmount, "Not enough allowance");
    require(token.balanceOf(msg.sender) < mintAmount, "Not enough balance");

    require(token.transferFrom(msg.sender, address(this), mintAmount), "transfer failed");
    balance[msg.sender] += mintAmount;
  }

  function redeem(uint redeemTokens) external returns (uint) {
    require(balance[msg.sender] >= redeemTokens, "Not enough tokens");

    balance[msg.sender] -= redeemTokens;
    require(token.transfer(msg.sender, redeemTokens), "transfer failed");
  }

  function balanceOfUnderlying(address owner) external returns (uint) {
    return balance[owner];
  }
}
