// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IOwnedUpgradeabilityProxy {
    function proxyOwner() external view returns (address owner);

    function pendingProxyOwner() external view returns (address pendingOwner);

    function transferProxyOwnership(address newOwner) external;

    function claimProxyOwnership() external;

    function upgradeTo(address implementation) external;

    function implementation() external view returns (address impl);
}
