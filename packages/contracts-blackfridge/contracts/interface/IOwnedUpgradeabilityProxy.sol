// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnedUpgradeabilityProxy {
    function transferProxyOwnership(address newOwner) external;

    function claimProxyOwnership() external;

    function upgradeTo(address implementation) external;
}
