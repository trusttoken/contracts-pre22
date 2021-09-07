// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface IPoolFactory {
    function isSupportedPool(ITrueFiPool2 pool) external view returns (bool);

    function getSupportedPools() external view returns (ITrueFiPool2[] memory);

    function supportedPoolsTVL() external view returns (uint256);
}
