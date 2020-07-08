// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {OwnedUpgradeabilityProxy} from "./OwnedUpgradeabilityProxy.sol";

/**
 * @title TimeOwnedUpgradeabilityProxy
 * @dev This contract combines an upgradeability proxy with
 * basic authorization control functionalities
 *
 * This contract allows us to specify a time at which the proxy can no longer
 * be upgraded
 */
contract TimeOwnedUpgradeabilityProxy is OwnedUpgradeabilityProxy {
    // solhint-disable-next-line const-name-snakecase
    bytes32 private constant expirationPosition = bytes32(uint256(keccak256("trusttoken.expiration")) - 1);

    /**
     * @dev the constructor sets the original owner of the contract to the sender account.
     */
    constructor() public {
        _setUpgradeabilityOwner(msg.sender);
        // set expiration to ~4 months from now
        _setExpiration(block.timestamp + 124 days);
    }

    /**
     * @dev sets new expiration time
     */
    function setExpiration(uint256 newExpirationTime) external onlyProxyOwner {
        require(block.timestamp < expiration(), "after expiration time");
        require(block.timestamp < newExpirationTime, "new expiration time must be in the future");
        _setExpiration(newExpirationTime);
    }

    function _setExpiration(uint256 newExpirationTime) internal onlyProxyOwner {
        bytes32 position = expirationPosition;
        assembly {
            sstore(position, newExpirationTime)
        }
    }

    function expiration() public view returns (uint256 _expiration) {
        bytes32 position = expirationPosition;
        assembly {
            _expiration := sload(position)
        }
    }

    /**
     * @dev Allows the proxy owner to upgrade the current version of the proxy.
     * @param implementation representing the address of the new implementation to be set.
     */
    function upgradeTo(address implementation) public override onlyProxyOwner {
        require(block.timestamp < expiration(), "after expiration date");
        super.upgradeTo(implementation);
    }
}
