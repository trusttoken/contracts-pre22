// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICurve} from "../truefi/interface/ICurve.sol";

contract CrvBaseRateOracle {
    using SafeMath for uint256;

    uint16 public constant MAX_BUFFER_SIZE = 365;

    // A cyclic buffer structure for storing historical values.
    // latestIndex points to the previously inserted value
    // should be inserted.
    struct HistoricalRatesBuffer {
        uint256[MAX_BUFFER_SIZE] cumsum;
        uint256[MAX_BUFFER_SIZE] timestamps;
        uint16 latestIndex;
        uint256 lastRate;
    }
    HistoricalRatesBuffer public histBuffer;

    ICurve public curve;

    // A fixed amount of time to wait
    // to be able to update the historical buffer
    uint256 public cooldownTime;

    /**
     * @dev Throws if cooldown is on when updating the historical buffer
     */
    modifier offCooldown() {
        // get the last timestamp written into the buffer
        // lastWritten = timestamps[latestIndex - 1]
        uint256 lastWritten = histBuffer.timestamps[histBuffer.latestIndex];
        require(block.timestamp >= lastWritten.add(cooldownTime), "CrvBaseRateOracle: Buffer on cooldown");
        _;
    }

    constructor(ICurve _curve, uint256 _cooldownTime) public {
        curve = _curve;
        cooldownTime = _cooldownTime;

        // fill one field up of the historical buffer
        // so the first calculateAverageRate call won't return 0
        histBuffer.lastRate = curve.get_virtual_price();
        histBuffer.timestamps[0] = block.timestamp;
    }

    function bufferSize() public virtual pure returns (uint16) {
        return 365;
    }

    /**
     * @dev Helper function to get contents of the historical buffer
     */
    function getHistBuffer()
        public
        view
        returns (
            uint256[MAX_BUFFER_SIZE] memory,
            uint256[MAX_BUFFER_SIZE] memory,
            uint16
        )
    {
        return (histBuffer.cumsum, histBuffer.timestamps, histBuffer.latestIndex);
    }

    /**
     * @dev Update the historical buffer:
     * overwrites the oldest value with current one
     * and updates its timestamp
     */
    function updateRate() public offCooldown {
        uint16 iidx = histBuffer.latestIndex;
        uint16 nextIndex = (iidx + 1) % bufferSize();
        uint256 rate = curve.get_virtual_price();
        uint256 dt = block.timestamp.sub(histBuffer.timestamps[iidx]);
        histBuffer.cumsum[nextIndex] = histBuffer.cumsum[iidx].add(rate.add(histBuffer.lastRate).mul(dt).div(2));
        histBuffer.timestamps[nextIndex] = block.timestamp;
        histBuffer.lastRate = rate;
        histBuffer.latestIndex = nextIndex;
    }

    /**
     * @dev Average rate is calculated by taking
     * the time-weighted average of the curve virtual prices.
     * Formula is given below:
     *
     *           (v + v_{n-1}) / 2 * (t - t_{n-1}) + sum_{i=1}^{n - 1} (v_i + v_{i-1}) / 2 * (t_i - t_{i-1})
     * avgRate = -------------------------------------------------------------------------------------------
     *                                                  (t - t_0)
     *
     * where v_i, t_i are values of the prices and their respective timestamps
     * stored in the historical buffer, v is a value of current price ant t is its timestamp.
     * Index n-1 corresponds to the most recent values and index 0 to the oldest ones.
     * Notice that whether we are going to use the whole buffer or not
     * depends on value of timeToCover parameter.
     * @param timeToCover For how much time average should be calculated
     * @return Average rate in basis points
     */
    function calculateAverageRate(uint256 timeToCover) public view returns (uint256) {
        require(1 days <= timeToCover && timeToCover <= 365 days, "CrvBaseRateOracle: Expected amount of time in range 1 to 365 days");
        // estimate how much buffer we need to use
        uint16 bufferSizeNeeded = uint16(timeToCover.div(cooldownTime));
        require(bufferSizeNeeded <= bufferSize(), "CrvBaseRateOracle: Needed buffer size cannot exceed size limit");
        uint16 iidx = histBuffer.latestIndex;
        uint16 startIndex = (iidx + bufferSize() - bufferSizeNeeded + 1) % bufferSize();
        if (histBuffer.timestamps[startIndex] == 0) {
            startIndex = 0;
        }
        uint256 sum = histBuffer.cumsum[iidx].sub(histBuffer.cumsum[startIndex]);
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        uint256 dt = curTimestamp.sub(histBuffer.timestamps[iidx]);
        sum = sum.add(curCrvBaseRate.add(histBuffer.lastRate).mul(dt).div(2));
        uint256 totalTime = curTimestamp.sub(histBuffer.timestamps[startIndex]);
        return sum.mul(10000).div(totalTime);
    }

    /**
     * @dev What percent of average rate is difference of current rate and average rate.
     * Based on average rate from collected data in the nearest past.
     * @param time Determines from how far in the past collected data should be used.
     * @return Calculated percentage of estimated apy.
     */
    function apy(uint256 time) internal view returns (int256) {
        int256 avgRate = int256(calculateAverageRate(time));
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return ((int256(curCrvBaseRate.mul(10000)) - avgRate) * 10000) / avgRate;
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
