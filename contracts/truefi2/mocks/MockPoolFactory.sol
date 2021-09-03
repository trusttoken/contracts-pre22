// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IPoolFactory} from "../interface/IPoolFactory.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";

contract MockPoolFactory is IPoolFactory {
    using SafeMath for uint256;
    mapping(address => bool) public override isPool;
    ITrueFiPool2[] public supportedPools;

    function getSupportedPools() external override view returns (ITrueFiPool2[] memory) {
        return supportedPools;
    }

    function isSupportedPool(ITrueFiPool2 pool) external override view returns (bool) {
        return address(pool) != address(0);
    }

    function supportPool(ITrueFiPool2 _pool) external {
        supportedPools.push(_pool);
    }

    function tvl() public override view returns (uint256) {
        uint256 _tvl = 0;
        for (uint256 i = 0; i < supportedPools.length; i++) {
            _tvl = _tvl.add(supportedPools[i].oracle().tokenToUsd(supportedPools[i].poolValue()));
        }
        return _tvl;
    }
}
