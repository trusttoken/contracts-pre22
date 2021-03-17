// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITrueFiPool {
    function initialize(ERC20 _token) external;
}
