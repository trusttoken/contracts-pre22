pragma solidity ^0.5.13;

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
    require(_reserve == address(aToken), "incorrect reserve");
    aToken.mint(msg.sender, _amount);
  }
}
