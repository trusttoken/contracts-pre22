// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAaveLendingPool} from "./interface/IAaveLendingPool.sol";

/**
 * @title SpotBaseRateOracle
 * @dev Oracle to get spot rates from different lending protocols
 */
contract SpotBaseRateOracle {
    using SafeMath for uint256;

    /// @dev Aave lending pool contract
    IAaveLendingPool public aaveLendingPool;

    /// @dev constructor which sets aave pool to `_aaveLendingPool`
    constructor(IAaveLendingPool _aaveLendingPool) public {
        aaveLendingPool = _aaveLendingPool;
    }

    /**
     * @dev Get rate for an `asset`
     * @param asset Asset to get rate for
     * @return Borrow rate for `asset`
     */
    function getRate(address asset) external view returns (uint256) {
        return _getAaveVariableBorrowAPY(asset);
    }

    /**
     * @dev Internal function to get Aave variable borrow apy for `asset`
     * @return Variable borrow rate for an asset
     */
    function _getAaveVariableBorrowAPY(address asset) internal view returns (uint256) {
        (, , , , uint128 currentVariableBorrowRate, , , , , , , ) = aaveLendingPool.getReserveData(asset);
        return uint256(currentVariableBorrowRate).div(1e23);
    }
}
