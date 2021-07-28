// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {AaveBaseRateOracle} from "../AaveBaseRateOracle.sol";
import {IAaveLendingPool} from "../interface/IAave.sol";

contract TestAaveBaseRateOracle is AaveBaseRateOracle {
    constructor(
        IAaveLendingPool _aavePool,
        uint256 _cooldownTime,
        address _asset
    ) public AaveBaseRateOracle(_aavePool, _cooldownTime, _asset) {}

    function bufferSize() public override pure returns (uint16) {
        return 7;
    }

    function getAaveVariableBorrowAPY() public view returns (uint256) {
        return _getAaveVariableBorrowAPY();
    }
}
