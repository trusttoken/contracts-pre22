// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAaveLendingPool} from "./interface/IAaveLendingPool.sol";

contract SpotBaseRateOracle {
    using SafeMath for uint256;

    IAaveLendingPool public aaveLendingPool;

    constructor(IAaveLendingPool _aaveLendingPool) public {
        aaveLendingPool = _aaveLendingPool;
    }

    function getRate(address asset) external view returns (uint256) {
        return _getAaveVariableBorrowAPY(asset);
    }

    function _getAaveVariableBorrowAPY(address asset) internal view returns (uint256) {
        (, , , , uint128 currentVariableBorrowRate, , , , , , , ) = aaveLendingPool.getReserveData(asset);
        return uint256(currentVariableBorrowRate).div(1e23);
    }
}
