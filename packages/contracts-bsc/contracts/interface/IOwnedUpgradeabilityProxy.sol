// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IOwnedUpgradeabilityProxy {
    function transferProxyOwnership(address newOwner) external;

    function claimProxyOwnership() external;

    function upgradeTo(address implementation) external;
}
