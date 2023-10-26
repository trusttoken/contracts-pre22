// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import "../interface/IConfigV1.sol";
import "../library/DefineRole.sol";

abstract contract BaseVerifyUpgradeableV1 is ContextUpgradeable{
  
  //////////////////// storage
  IConfigV1 public config;
  
  function __BaseVerifyUpgradeableV1_init(address addr) internal onlyInitializing{
    __Context_init();
    
    __BaseVerifyUpgradeableV1_unchained(addr);
  }

  function __BaseVerifyUpgradeableV1_unchained(address addr) internal onlyInitializing{
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

  uint256[50] private __gap;
}
