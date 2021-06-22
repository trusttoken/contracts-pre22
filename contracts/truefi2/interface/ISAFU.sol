// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ISAFU {
    function poolDeficit(ITrueFiPool2 pool) external view returns (uint256);
}
