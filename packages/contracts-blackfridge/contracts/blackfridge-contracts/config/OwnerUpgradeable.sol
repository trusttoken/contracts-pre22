// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "../library/DefineRole.sol";

abstract contract OwnerUpgradeable is AccessControlEnumerableUpgradeable {

  function __OwnerUpgradeable_init(address superadmin_) internal onlyInitializing{
    __AccessControlEnumerable_init();
    __OwnerUpgradeable_init_unchained(superadmin_);
  }

  function __OwnerUpgradeable_init_unchained(address superadmin_) internal onlyInitializing{
    if(superadmin_ == address(0x0)){
      superadmin_ = _msgSender();
    }
    _setupRole(DEFAULT_ADMIN_ROLE, superadmin_);
  }    

  function revokeRole(bytes32 role, address account) public virtual override{
    if(role == DEFAULT_ADMIN_ROLE && getRoleMemberCount(role) == 1){
      revert("can't del last super admin");
    }

    super.revokeRole(role, account);
  }

  function renounceRole(bytes32 role, address account) public virtual override{
    if(role == DEFAULT_ADMIN_ROLE && getRoleMemberCount(role) == 1){
      revert("can't del last super admin");
    }

    super.renounceRole(role, account);
  }

  function isAdmin(address addr) public virtual view returns(bool){
    return hasRole(DefineRole.ADMIN_ROLE, addr) || hasRole(DEFAULT_ADMIN_ROLE, addr);
  }

  modifier IsAdmin() {
    if(!isAdmin(_msgSender())){
      revert("not admin");
    }
    _;
  }

  modifier IsSuperAdmin(){
    _checkRole(DEFAULT_ADMIN_ROLE, _msgSender());
    _;
  }

  uint256[49] private __gap;
}
