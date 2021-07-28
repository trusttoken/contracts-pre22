// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IAaveLendingPool} from "./interface/IAave.sol";

contract AaveBaseRateOracle {
    using SafeMath for uint256;

    uint16 public constant BUFFER_SIZE = 365;
    uint256 private constant BASIS_PRECISION = 10000;

    // A cyclic buffer structure for storing running total (cumulative sum)
    // values and their respective timestamps.
    // latestIndex points to the previously inserted value.
    struct RunningTotalsBuffer {
        uint256[BUFFER_SIZE] runningTotals;
        uint256[BUFFER_SIZE] timestamps;
        uint16 currIndex;
        uint256 lastValue;
    }
    RunningTotalsBuffer public totalsBuffer;

    IAaveLendingPool public aavePool;

    address asset;

    // A fixed amount of time to wait
    // to be able to update the totalsBuffer
    uint256 public cooldownTime;

    /**
     * @dev Throws if cooldown is on when updating the totalsBuffer
     */
    modifier offCooldown() {
        // get the last timestamp written into the buffer
        uint256 lastWritten = totalsBuffer.timestamps[totalsBuffer.currIndex];
        require(block.timestamp >= lastWritten.add(cooldownTime), "AaveBaseRateOracle: Buffer on cooldown");
        _;
    }

    constructor(
        IAaveLendingPool _aavePool,
        uint256 _cooldownTime,
        address _asset
    ) public {
        aavePool = _aavePool;
        cooldownTime = _cooldownTime;
        asset = _asset;

        totalsBuffer.lastValue = getAaveVariableBorrowAPY();
        totalsBuffer.timestamps[0] = block.timestamp;
    }

    function bufferSize() public virtual pure returns (uint16) {
        return BUFFER_SIZE;
    }

    /**
     * @dev Helper function to get contents of the totalsBuffer
     */
    function getTotalsBuffer()
        public
        view
        returns (
            uint256[BUFFER_SIZE] memory,
            uint256[BUFFER_SIZE] memory,
            uint16
        )
    {
        return (totalsBuffer.runningTotals, totalsBuffer.timestamps, totalsBuffer.currIndex);
    }

    function getAaveVariableBorrowAPY() internal view returns (uint256) {
        (, , , , uint128 currentVariableBorrowRate, , , , , , , ) = aavePool.getReserveData(asset);
        return uint256(currentVariableBorrowRate).div(1e23);
    }

    /**
     * @dev Update the totalsBuffer:
     * Gets current deposit apy from aave and writes down
     * new total running value.
     * If the buffer is filled overwrites the oldest value
     * with a new one and updates its timestamp.
     */
    function update() public offCooldown {
        uint16 _currIndex = totalsBuffer.currIndex;
        uint16 nextIndex = (_currIndex + 1) % bufferSize();
        uint256 apy = getAaveVariableBorrowAPY();
        uint256 dt = block.timestamp.sub(totalsBuffer.timestamps[_currIndex]);
        totalsBuffer.runningTotals[nextIndex] = totalsBuffer.runningTotals[_currIndex].add(
            apy.add(totalsBuffer.lastValue).mul(dt).div(2)
        );
        totalsBuffer.timestamps[nextIndex] = block.timestamp;
        totalsBuffer.lastValue = apy;
        totalsBuffer.currIndex = nextIndex;
    }

    /**
     * @dev Average apy is calculated by taking
     * the time-weighted average of the aave variable borrowing apys.
     * Essentially formula given below is used:
     *
     *           (v + v_{n-1}) / 2 * (t - t_{n-1}) + sum_{i=1}^{n - 1} (v_i + v_{i-1}) / 2 * (t_i - t_{i-1})
     * avgAPY = -------------------------------------------------------------------------------------------
     *                                                  (t - t_0)
     *
     * where v_i, t_i are values of the prices and their respective timestamps
     * stored in the historical buffer, v is a value of current price ant t is its timestamp.
     * Index n-1 corresponds to the most recent values and index 0 to the oldest ones.
     *
     * To avoid costly computations in a loop an optimization is used:
     * Instead of directly storing apys we store calculated numerators from formula above.
     * This gives us most of the job done for every calculation.
     *
     * @param numberOfUpdates How many elements of buffer should be involved in calculation.
     * @return Average apy.
     */
    function calculateAverageAPY(uint16 numberOfUpdates) public view returns (uint256) {
        require(numberOfUpdates <= bufferSize(), "AaveBaseRateOracle: Number of updates is limited by buffer size");

        uint16 _currIndex = totalsBuffer.currIndex;
        uint16 startIndex = (_currIndex + bufferSize() - numberOfUpdates + 1) % bufferSize();
        if (totalsBuffer.timestamps[startIndex] == 0) {
            startIndex = 0;
        }
        uint256 runningTotalForTimeToCover = totalsBuffer.runningTotals[_currIndex].sub(totalsBuffer.runningTotals[startIndex]);
        uint256 curValue = getAaveVariableBorrowAPY();
        uint256 curTimestamp = block.timestamp;
        uint256 dt = curTimestamp.sub(totalsBuffer.timestamps[_currIndex]);
        runningTotalForTimeToCover = runningTotalForTimeToCover.add(curValue.add(totalsBuffer.lastValue).mul(dt).div(2));
        uint256 totalTime = curTimestamp.sub(totalsBuffer.timestamps[startIndex]);
        return runningTotalForTimeToCover.div(totalTime);
    }

    /**
     * @dev apy based on data from last 7 days.
     */
    function getWeeklyAPY() public view returns (uint256) {
        return calculateAverageAPY(7);
    }

    /**
     * @dev apy based on data from last 30 days.
     */
    function getMonthlyAPY() public view returns (uint256) {
        return calculateAverageAPY(30);
    }

    /**
     * @dev apy based on data from last 365 days.
     */
    function getYearlyAPY() public view returns (uint256) {
        return calculateAverageAPY(365);
    }
}
