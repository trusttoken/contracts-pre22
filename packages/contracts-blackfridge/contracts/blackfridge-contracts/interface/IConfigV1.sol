// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

interface IConfigV1{

  // 兼容normal and upgradeable.
  function supportsInterface(bytes4 interfaceId) external view returns (bool);

  // role
  function isAdmin(address addr) external view returns(bool yes);
  function hasRole(bytes32 role, address addr) external view returns(bool yes);

  //////////////////// args
  function getDecimal() external view returns(uint256 decimal);
  
  function getUInt256(bytes32 key) external view returns(uint256 r);
  function getUInt256Slice(bytes32 key) external view returns(uint256[] memory r);

  function getAddress(bytes32 key) external view returns(address r);
  function getAddressSlice(bytes32 key) external view returns(address[] memory r);

  function getBytes32(bytes32 key) external view returns(bytes32 r);
  function getBytes32Slice(bytes32 key) external view returns(bytes32[] memory r);

  function getBytes(bytes32 key) external view returns(bytes memory r);
  function getString(bytes32 key) external view returns(string memory r);

  function getRawValue(bytes32 key) external view returns(bytes32 typeID, bytes memory data);


  //////////////////// tool
  function getKey(string memory keyStr) external pure returns(bytes32 key);
}
