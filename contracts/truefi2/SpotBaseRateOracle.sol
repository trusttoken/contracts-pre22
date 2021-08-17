// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAaveLendingPool} from "./interface/IAaveLendingPool.sol";
import {ICToken} from "./interface/ICToken.sol";

/**
 * @title SpotBaseRateOracle
 * @dev Oracle to get spot rates from different lending protocols
 */
contract SpotBaseRateOracle {
    using SafeMath for uint256;

    /// @dev Aave lending pool contract
    IAaveLendingPool public aaveLendingPool;
    uint256 public blocksPerDay;

    /// @dev constructor which sets aave pool to `_aaveLendingPool`
    constructor(IAaveLendingPool _aaveLendingPool) public {
        aaveLendingPool = _aaveLendingPool;
        blocksPerDay = 6500;
    }

    // To-do ownable
    function setBlocksPerDay(uint256 _blocksPerDay) external {
        blocksPerDay = _blocksPerDay;
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

    function _getCompoundBorrowAPY(address asset) internal view returns (uint256 apy) {
        uint256 borrowRatePerBlock = ICToken(asset).borrowRatePerBlock();
        uint256 exponent = borrowRatePerBlock.mul(blocksPerDay).div(1e18).add(1);
        apy = (exponent**365 - 1) * 100;
    }
}
