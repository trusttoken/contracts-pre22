// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "./OwnerUpgradeable.sol";
import "../interface/IConfigV1.sol";

import "../library/LEnumerableMetadata.sol";

contract ConfigUpgradeable is IConfigV1, OwnerUpgradeable {
  //////////////////// using
  using LEnumerableMetadata for LEnumerableMetadata.MetadataSet;

  //////////////////// constant
  uint256 private constant DECIMAL = 1e18;

  //////////////////// store
  LEnumerableMetadata.MetadataSet private _configSet;

  //////////////////// init
  function initialize(address superadmin_) public initializer{
    __ConfigUpgradeable_init(superadmin_);
  }
  
  function __ConfigUpgradeable_init(address superadmin_) internal onlyInitializing{
    __OwnerUpgradeable_init(superadmin_);
    __ConfigUpgradeable_unchained();
  }

  function __ConfigUpgradeable_unchained() internal onlyInitializing{
    _configSet._init();
  }
  
  //////////////////// public read
  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerableUpgradeable,IConfigV1) returns (bool) {
    return interfaceId == type(IConfigV1).interfaceId
      || super.supportsInterface(interfaceId);
  }

  function isAdmin(address addr) public view override(OwnerUpgradeable,IConfigV1) returns(bool){
    return super.isAdmin(addr);
  }

  function hasRole(bytes32 role, address account) public view override(IAccessControlUpgradeable,IConfigV1) returns (bool){
    return super.hasRole(role, account);
  }

  //////////////////// args
  function getDecimal() public pure override returns(uint256 decimal){
    return DECIMAL;
  }

  /////
  function getUInt256(bytes32 key) public view override returns(uint256 r){
    return abi.decode(getBytes(key), (uint256));
  }
  
  function getUInt256Slice(bytes32 key) public view override returns(uint256[] memory r){
    return abi.decode(getBytes(key), (uint256[]));
  }

  function getAddress(bytes32 key) public view override returns(address r){
    return abi.decode(getBytes(key), (address));
  }
  function getAddressSlice(bytes32 key) public view override returns(address[] memory r){
    return abi.decode(getBytes(key), (address[]));
  }

  function getBytes32(bytes32 key) public view override returns(bytes32 r){
    return abi.decode(getBytes(key), (bytes32));
  }
  
  function getBytes32Slice(bytes32 key) public view override returns(bytes32[] memory r){
    return abi.decode(getBytes(key), (bytes32[]));
  }

  function getString(bytes32 key) public view override returns(string memory r){
    return abi.decode(getBytes(key), (string));
  }

  function getBytes(bytes32 key) public view override returns(bytes memory r){
    bytes memory data;
    (, data) = _configSet._get(key);
    require(data.length > 0, "no data");
    
    return data;
  }

  function getRawValue(bytes32 key) public view override returns(bytes32 typeID, bytes memory data){
    return _configSet._get(key);
  }

  function getKey(string memory keyStr) public pure override returns(bytes32 key){
    return LEnumerableMetadata._getKeyID(keyStr);
  }

  function getAllkeys(
      string memory startKey,
      uint256 pageSize
  ) public view returns (string[] memory keys) {
    return _configSet._getAllKeys(startKey, pageSize);
  }

  //////////////////// write config

  function setKVs(bytes[] memory mds) public IsAdmin{
    _configSet._setBytesSlice(mds);
  }

  function setKV(string memory key, bytes32 typeID, bytes memory data) public IsAdmin{
    if (data.length == 0){
      _configSet._del(key);
      return;
    }

    _configSet._addOrChange(key, typeID, data);
  }
}
