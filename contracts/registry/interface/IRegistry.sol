// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IHasOwner} from "./IHasOwner.sol";
import {IRegistryClone} from "./IRegistryClone.sol";

import {IReclaimerToken} from "../../true-currencies/interface/IReclaimerToken.sol";

interface IRegistry is IHasOwner, IReclaimerToken {
    function setAttribute(
        address _who,
        bytes32 _attribute,
        uint256 _value,
        bytes32 _notes
    ) external;

    function subscribe(bytes32 _attribute, IRegistryClone _syncer) external;

    function unsubscribe(bytes32 _attribute, uint256 _index) external;

    function subscriberCount(bytes32 _attribute) external view returns (uint256);

    function setAttributeValue(
        address _who,
        bytes32 _attribute,
        uint256 _value
    ) external;

    function hasAttribute(address _who, bytes32 _attribute) external view returns (bool);

    function getAttribute(address _who, bytes32 _attribute)
        external
        view
        returns (
            uint256,
            bytes32,
            address,
            uint256
        );

    function getAttributeValue(address _who, bytes32 _attribute) external view returns (uint256);

    function getAttributeAdminAddr(address _who, bytes32 _attribute) external view returns (address);

    function getAttributeTimestamp(address _who, bytes32 _attribute) external view returns (uint256);

    function syncAttribute(
        bytes32 _attribute,
        uint256 _startIndex,
        address[] calldata _addresses
    ) external;
}
