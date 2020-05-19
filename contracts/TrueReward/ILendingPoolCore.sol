pragma solidity ^0.5.13;

interface ILendingPoolCore {
  function getReserveNormalizedIncome(address _reserve) external view returns (uint256);
  function transferToReserve(address _reserve, address payable _user, uint256 _amount) external;
}
