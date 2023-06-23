// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20Plus} from "./IERC20Plus.sol";

interface IMintableXC20 is IERC20Plus {
    function freeze(address account) external returns (bool);

    function thaw(address account) external returns (bool);

    function freezeAsset() external returns (bool);

    function thawAsset() external returns (bool);

    function forceTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}
