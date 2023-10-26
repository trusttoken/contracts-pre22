// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";

import "../proxy/BFProxy.sol";
import "../proxy/BFBeacon.sol";
import "./ChargeUpgradeable.sol";
import "../library/DefineRole.sol";

import "../base/BaseVerifyUpgradeableV1.sol";

contract ChargeFactoryUpgradeable is BaseVerifyUpgradeableV1{
  //////////////////// storage
  BFProxy public proxy;
  BFBeacon public beacon;

  // addr -> salt
  mapping(address=>bytes32) public addr2Salt;

  //////////////////// init
  function initialize(address configAddr, address implement) public virtual initializer {
    __ChargeFactoryUpgradeable_init(configAddr, implement);
  }

  function __ChargeFactoryUpgradeable_init(address configAddr, address implement) internal onlyInitializing{
    __BaseVerifyUpgradeableV1_init(configAddr);
    __ChargeFactoryUpgradeable_unchained(configAddr, implement);
  }

  function __ChargeFactoryUpgradeable_unchained(address configAddr, address implement) internal onlyInitializing{
    proxy = new BFProxy();
    beacon = new BFBeacon(implement, configAddr);
  }

  //////////////////// event
  event NewCharge(address indexed addr, address indexed creator);

  //////////////////// public write
  function CreateCharge(bytes32[] memory salts) public onlyRole(DefineRole.CHARGE_CREATER_ROLE){
    for(uint256 i = 0; i < salts.length; i++){
      _createCharge(salts[i]);
    }
  }

  function Collect(address addr, bytes32 salt, address[] memory tokens) public onlyRole(DefineRole.CHARGE_COLLECTOR_ROLE){
    bytes32 addrSalt = addr2Salt[addr];
    if(addrSalt == 0x00){
      // create addr
      address newAddr = _createCharge(salt);
      require(newAddr == addr, "salt err");
      addr = newAddr;
    }

    ChargeUpgradeable(addr).collect(tokens, false);
  }

  //////////////////// public read
  function predictAddrs(bytes32[] memory salts) public view returns(address[] memory addrs){
    addrs = new address[](salts.length);

    for(uint256 i = 0; i < salts.length; i++){
      addrs[i] = Clones.predictDeterministicAddress(address(proxy), salts[i]);
    }
    return addrs;
  }

  //////////////////// internal
  function _createCharge(bytes32 salt) internal returns(address){
    require(salt != 0x00, "salt is empty");
    
    address addr;
    addr = Clones.cloneDeterministic(address(proxy), salt);

    BFProxy(payable(addr)).init(address(beacon), "");
    ChargeUpgradeable(addr).initialize(address(config));

    addr2Salt[addr] = salt;
      
    emit NewCharge(addr, msg.sender);
    return addr;
  }
}
