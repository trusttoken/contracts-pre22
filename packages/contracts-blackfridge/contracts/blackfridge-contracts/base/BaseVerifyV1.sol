// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "../interface/IConfigV1.sol";
import "../library/DefineRole.sol";

abstract contract BaseVerifyV1 is Context{
  //////////////////// constant
  bytes32 private constant DEFAULT_ADMIN_ROLE = 0x00;
  
  //////////////////// storage
  IConfigV1 public config;

  constructor(address addr){
    config = IConfigV1(addr);
    require(config.supportsInterface(type(IConfigV1).interfaceId), "not support addr");
  }

  modifier IsAdmin(){
    require(config.isAdmin(_msgSender()), "not admin");
    _;
  }

  modifier onlyRole(bytes32 role){
    require(config.hasRole(role, _msgSender()) || config.hasRole(DefineRole.DEFAULT_ADMIN_ROLE, _msgSender()), "not has role");
    _;
  }
}
