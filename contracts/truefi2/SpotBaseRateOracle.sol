// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAaveLendingPool} from "./interface/IAaveLendingPool.sol";

contract SpotBaseRateOracle {
    using SafeMath for uint256;

    address public asset;

    IAaveLendingPool public aaveLendingPool;

    uint256 public aaveWeight;

    constructor(
        address _asset,
        IAaveLendingPool _aaveLendingPool,
        uint256 _aaveWeight
    ) public {
        asset = _asset;
        aaveLendingPool = _aaveLendingPool;
        aaveWeight = _aaveWeight;
    }

    function getWeightedBaseRate() external view returns (uint256) {
        return _getAaveVariableBorrowAPY().mul(aaveWeight).div(_weightSum());
    }

    function _getAaveVariableBorrowAPY() internal view returns (uint256) {
        (, , , , uint128 currentVariableBorrowRate, , , , , , , ) = aaveLendingPool.getReserveData(asset);
        return uint256(currentVariableBorrowRate).div(1e23);
    }

    function _weightSum() internal view returns (uint256) {
        // as more protocols are included, more weights will be added
        return aaveWeight;
    }
}
