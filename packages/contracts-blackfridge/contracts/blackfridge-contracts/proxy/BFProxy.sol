//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";

contract BFProxy is Proxy {
  //////////////////// only public
  function implementation() public view virtual returns (address) {
    return _implementation();
  }

  //////////////////// public for proxy admin
  function getBeaconAddr() public view returns (address addr) {
    return _getBeacon();
  }

  //////////////////// init once
  function init(
                address beacon,
                bytes memory data
                ) public payable {
    if (_getBeacon() != address(0x0)) {
      _fallback();
    } else {
      _selfInit(beacon, data);
    }
  }

  //////////////////// setting proxy admin
  function _selfInit(
                     address beacon,
                     bytes memory data
                     ) internal {
    _upgradeBeaconToAndCall(beacon, data, false);
  }

  /**
   * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
   * This is bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)) and is validated in the constructor.
   */
  bytes32 internal constant _BEACON_SLOT =
    0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

  /**
   * @dev Emitted when the beacon is upgraded.
   */
  event BeaconUpgraded(address indexed beacon);

  /**
   * @dev Returns the current beacon.
   */
  function _getBeacon() internal view returns (address) {
    return StorageSlot.getAddressSlot(_BEACON_SLOT).value;
  }

  /**
   * @dev Returns the current implementation address of the associated beacon.
   */
  function _implementation()
    internal
    view
    virtual
    override
    returns (address)
  {
    return IBeacon(_getBeacon()).implementation();
  }

  /**
   * @dev Stores a new beacon in the EIP1967 beacon slot.
   */
  function _setBeacon(address newBeacon) private {
    require(
            Address.isContract(newBeacon),
            "ERC1967: new beacon is not a contract"
            );
    require(
            Address.isContract(IBeacon(newBeacon).implementation()),
            "ERC1967: beacon implementation is not a contract"
            );
    StorageSlot.getAddressSlot(_BEACON_SLOT).value = newBeacon;
  }

  /**
   * @dev Perform beacon upgrade with additional setup call. Note: This upgrades the address of the beacon, it does
   * not upgrade the implementation contained in the beacon (see {UpgradeableBeacon-_setImplementation} for that).
   *
   * Emits a {BeaconUpgraded} event.
   */
  function _upgradeBeaconToAndCall(
                                   address newBeacon,
                                   bytes memory data,
                                   bool forceCall
                                   ) internal {
    _setBeacon(newBeacon);
    emit BeaconUpgraded(newBeacon);
    if (data.length > 0 || forceCall) {
      Address.functionDelegateCall(
                                   IBeacon(newBeacon).implementation(),
                                   data
                                   );
    }
  }
}
