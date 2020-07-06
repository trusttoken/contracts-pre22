// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface ILendingPoolCore {
  function getReserveNormalizedIncome(address _reserve) external view returns (uint256);
  function transferToReserve(address _reserve, address payable _user, uint256 _amount) external;
}
