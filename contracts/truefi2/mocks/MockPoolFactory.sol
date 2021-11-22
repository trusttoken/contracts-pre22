// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IPoolFactory} from "../interface/IPoolFactory.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";

contract MockPoolFactory is IPoolFactory {
    using SafeMath for uint256;
    ITrueFiPool2[] public supportedPools;

    function getSupportedPools() external view override returns (ITrueFiPool2[] memory) {
        return supportedPools;
    }

    function isSupportedPool(ITrueFiPool2 pool) external view override returns (bool) {
        return address(pool) != address(0);
    }

    function supportPool(ITrueFiPool2 _pool) external {
        supportedPools.push(_pool);
    }

    function supportedPoolsTVL() public view override returns (uint256) {
        uint256 tvl;
        for (uint256 i = 0; i < supportedPools.length; i++) {
            tvl = tvl.add(supportedPools[i].oracle().tokenToUsd(supportedPools[i].poolValue()));
        }
        return tvl;
    }
}
