pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../ILendingPool.sol";
import "../ILendingPoolCore.sol";
import "./ATokenMock.sol";

contract LendingPoolMock is ILendingPool {
  ILendingPoolCore public core;
  ATokenMock aToken;

  constructor(
    ILendingPoolCore _core,
    ATokenMock _aToken
  ) public {
    core = _core;
    aToken = _aToken;
  }

  function deposit(address _reserve, uint256 _amount, uint16 _referralCode) external {
    IERC20 token = aToken.token();
    require(_reserve == address(token), "incorrect reserve");
    require(token.allowance(msg.sender, address(this)) >= _amount, "not enough allowance");
    require(token.balanceOf(msg.sender) >= _amount, "not enough balance");

    require(token.transferFrom(msg.sender, address(this), _amount), "transfer failed");
    aToken.mint(msg.sender, _amount);
  }
}
