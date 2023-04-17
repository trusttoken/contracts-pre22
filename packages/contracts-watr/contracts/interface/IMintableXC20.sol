// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20Plus} from "./IERC20Plus.sol";

interface IMintableXC20 is IERC20Plus {
    function freeze(address account) external;

    function thaw(address account) external;
}
