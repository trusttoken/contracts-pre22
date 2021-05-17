// SPDX-License-Identifier: MIT

pragma solidity ^0.6.10;

import {IOwnedUpgradeabilityProxy} from "../../proxy/interface/IOwnedUpgradeabilityProxy.sol";
import {ImplementationReference} from "../../proxy/ImplementationReference.sol";
import {IPauseableContract} from "../../common/interface/IPauseableContract.sol";

interface ITimelock {
    function delay() external view returns (uint256);

    function GRACE_PERIOD() external view returns (uint256);

    function acceptAdmin() external;

    function queuedTransactions(bytes32 hash) external view returns (bool);

    function queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external returns (bytes32);

    function cancelTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external;

    function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external payable returns (bytes memory);

    function emergencyPauseProxy(IOwnedUpgradeabilityProxy proxy) external;

    function emergencyPauseReference(ImplementationReference implementationReference) external;

    function setPauseStatus(IPauseableContract pauseContract, bool status) external;
}
