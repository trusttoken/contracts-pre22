// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICurve} from "../truefi/interface/ICurve.sol";

contract CrvBaseRateOracle {
    using SafeMath for uint256;

    uint16 public constant MAX_BUFFER_SIZE = 365;
    uint256 private constant BASIS_PRECISION = 10000;

    // A cyclic buffer structure for storing running total (cumulative sum)
    // values and their respective timestamps.
    // latestIndex points to the previously inserted value.
    struct RunningTotalsBuffer {
        uint256[MAX_BUFFER_SIZE] runningTotals;
        uint256[MAX_BUFFER_SIZE] timestamps;
        uint16 latestIndex;
        uint256 lastRate;
    }
    RunningTotalsBuffer public totalsBuffer;

    ICurve public curve;

    // A fixed amount of time to wait
    // to be able to update the totalsBuffer
    uint256 public cooldownTime;

    /**
     * @dev Throws if cooldown is on when updating the totalsBuffer
     */
    modifier offCooldown() {
        // get the last timestamp written into the buffer
        uint256 lastWritten = totalsBuffer.timestamps[totalsBuffer.latestIndex];
        require(block.timestamp >= lastWritten.add(cooldownTime), "CrvBaseRateOracle: Buffer on cooldown");
        _;
    }

    constructor(ICurve _curve, uint256 _cooldownTime) public {
        curve = _curve;
        cooldownTime = _cooldownTime;

        totalsBuffer.lastRate = curve.get_virtual_price();
        totalsBuffer.timestamps[0] = block.timestamp;
    }

    function bufferSize() public virtual pure returns (uint16) {
        return MAX_BUFFER_SIZE;
    }

    /**
     * @dev Helper function to get contents of the totalsBuffer
     */
    function getTotalsBuffer()
        public
        view
        returns (
            uint256[MAX_BUFFER_SIZE] memory,
            uint256[MAX_BUFFER_SIZE] memory,
            uint16
        )
    {
        return (totalsBuffer.runningTotals, totalsBuffer.timestamps, totalsBuffer.latestIndex);
    }

    /**
     * @dev Update the totalsBuffer:
     * Gets current virtual price from Curve and writes down
     * new total running value.
     * If the buffer is filled overwrites the oldest value
     * with a new one and updates its timestamp.
     */
    function updateBuffer() public offCooldown {
        uint16 lidx = totalsBuffer.latestIndex;
        uint16 nextIndex = (lidx + 1) % bufferSize();
        uint256 rate = curve.get_virtual_price();
        uint256 dt = block.timestamp.sub(totalsBuffer.timestamps[lidx]);
        totalsBuffer.runningTotals[nextIndex] = totalsBuffer.runningTotals[lidx].add(rate.add(totalsBuffer.lastRate).mul(dt).div(2));
        totalsBuffer.timestamps[nextIndex] = block.timestamp;
        totalsBuffer.lastRate = rate;
        totalsBuffer.latestIndex = nextIndex;
    }

    /**
     * @dev Average rate is calculated by taking
     * the time-weighted average of the curve virtual prices.
     * Essentially formula given below is used:
     *
     *           (v + v_{n-1}) / 2 * (t - t_{n-1}) + sum_{i=1}^{n - 1} (v_i + v_{i-1}) / 2 * (t_i - t_{i-1})
     * avgRate = -------------------------------------------------------------------------------------------
     *                                                  (t - t_0)
     *
     * where v_i, t_i are values of the prices and their respective timestamps
     * stored in the historical buffer, v is a value of current price ant t is its timestamp.
     * Index n-1 corresponds to the most recent values and index 0 to the oldest ones.
     *
     * To avoid costly computations in a loop an optimization is used:
     * Instead of curve virtual prices calculated numerators from formula above are stored.
     * This gives us most of the job done for every calculation.
     *
     * Notice that whether we are going to use the whole buffer or not
     * depends on if it is filled up and the value of timeToCover parameter.
     * @param timeToCover For how much time average should be calculated.
     * @return Average rate in basis points.
     */
    function calculateAverageRate(uint256 timeToCover) public view returns (uint256) {
        require(1 days <= timeToCover && timeToCover <= 365 days, "CrvBaseRateOracle: Expected amount of time in range 1 to 365 days");
        // estimate how much buffer we need to use
        uint16 bufferSizeNeeded = uint16(timeToCover.div(cooldownTime));
        require(bufferSizeNeeded <= bufferSize(), "CrvBaseRateOracle: Needed buffer size cannot exceed size limit");
        uint16 lidx = totalsBuffer.latestIndex;
        uint16 startIndex = (lidx + bufferSize() - bufferSizeNeeded + 1) % bufferSize();
        if (totalsBuffer.timestamps[startIndex] == 0) {
            startIndex = 0;
        }
        uint256 runningTotalForTimeToCover = totalsBuffer.runningTotals[lidx].sub(totalsBuffer.runningTotals[startIndex]);
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        uint256 dt = curTimestamp.sub(totalsBuffer.timestamps[lidx]);
        runningTotalForTimeToCover = runningTotalForTimeToCover.add(curCrvBaseRate.add(totalsBuffer.lastRate).mul(dt).div(2));
        uint256 totalTime = curTimestamp.sub(totalsBuffer.timestamps[startIndex]);
        return runningTotalForTimeToCover.mul(BASIS_PRECISION).div(totalTime);
    }

    /**
     * @dev Calculate apy based on current curve virtual price and
     * average rate from collected data in the nearest past.
     * @param time Determines from how far in the past collected data should be used.
     * @return Calculated estimated apy in basis points.
     */
    function apy(uint256 time) internal view returns (int256) {
        int256 avgRate = int256(calculateAverageRate(time));
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return ((int256(curCrvBaseRate * BASIS_PRECISION) - avgRate) * int256(BASIS_PRECISION)) / avgRate;
    }

    /**
     * @dev APY based on data from last 7 days.
     */
    function getWeeklyAPY() public view returns (int256) {
        return apy(7 days);
    }

    /**
     * @dev APY based on data from last 30 days.
     */
    function getMonthlyAPY() public view returns (int256) {
        return apy(30 days);
    }

    /**
     * @dev APY based on data from last 365 days.
     */
    function getYearlyAPY() public view returns (int256) {
        return apy(365 days);
    }
}
