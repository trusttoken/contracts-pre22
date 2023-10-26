//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../base/BaseVerifyV1.sol";
import "../library/DefineRole.sol";

contract BFBeacon is IBeacon, BaseVerifyV1 {
  address private _implementation;

  /**
   * @dev Emitted when the implementation returned by the beacon is changed.
   */
  event Upgraded(address indexed implementation);

  /**
   * @dev Sets the address of the initial implementation, and the deployer account as the owner who can upgrade the
   * beacon.
   */
  constructor(address implementationAddr, address configAddr) BaseVerifyV1(configAddr){
    _setImplementation(implementationAddr);
  }
    
  modifier IsBeaconUpgrader(){
    require(config.hasRole(DefineRole.BEACON_UPGRADER, _msgSender()), "not beacon upgrader");
    _;
  }

  /**
   * @dev Returns the current implementation address.
   */
  function implementation() public view virtual override returns (address) {
    return _implementation;
  }

  /**
   * @dev Upgrades the beacon to a new implementation.
   *
   * Emits an {Upgraded} event.
   *
   * Requirements:
   *
   * - msg.sender must be the owner of the contract.
   * - `newImplementation` must be a contract.
   */
  function upgradeTo(address newImplementation) public virtual IsBeaconUpgrader {
    _setImplementation(newImplementation);
    emit Upgraded(newImplementation);
  }

  /**
   * @dev Sets the implementation contract address for this beacon
   *
   * Requirements:
   *
   * - `newImplementation` must be a contract.
   */
  function _setImplementation(address newImplementation) private {
    require(
            Address.isContract(newImplementation),
            "UpgradeableBeacon: implementation is not a contract"
            );
    _implementation = newImplementation;
  }
}
