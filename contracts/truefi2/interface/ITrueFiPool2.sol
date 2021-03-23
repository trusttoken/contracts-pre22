// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../../common/UpgradeableERC20.sol";

interface ITrueFiPool2 {
    function initialize(ERC20 _token) external;
}
