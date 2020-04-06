pragma solidity ^0.5.13;

import "../ILendingPoolCore.sol";

contract LendingPoolCoreMock is ILendingPoolCore {
  uint256 reserveNormalizedIncome = 1*10**27;

  function getReserveNormalizedIncome(address _reserve) external view returns (uint256) {
    return reserveNormalizedIncome;
  }

  function setReserveNormalizedIncome(uint256 value) external returns (uint256) {
    reserveNormalizedIncome = value;
  }
}
