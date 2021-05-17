// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICurve} from "../truefi/interface/ICurve.sol";

contract CrvBaseRateOracle {
    using SafeMath for uint256;
    using SafeMath for uint16;

    uint16 public constant MAX_BUFFER_SIZE = 365;

    ICurve public curve;

    // A cyclic buffer structure for storing historical values.
    // insertIndex points to the place where the next value
    // should be inserted.
    struct HistoricalRatesBuffer {
        uint256[MAX_BUFFER_SIZE] baseRates;
        uint256[MAX_BUFFER_SIZE] timestamps;
        uint16 insertIndex;
    }
    HistoricalRatesBuffer public histBuffer;

    // A fixed amount of time to wait
    // to be able to update the historical buffer
    uint256 public cooldownTime;

    /**
     * @dev Throws if cooldown is on when updating the historical buffer
     */
    modifier offCooldown() {
        uint256 lastUpdated = histBuffer.timestamps[histBuffer.insertIndex.add(bufferSize()).sub(1) % bufferSize()];
        require(block.timestamp >= lastUpdated.add(cooldownTime), "CrvBaseRateOracle: Buffer on cooldown");
        _;
    }

    constructor(ICurve _curve, uint256 _cooldownTime) public {
        curve = _curve;
        cooldownTime = _cooldownTime;

        // fill one field up of the historical buffer
        // so the first calculateAverageRate call won't return 0
        histBuffer.baseRates[0] = curve.get_virtual_price();
        histBuffer.timestamps[0] = block.timestamp;
        histBuffer.insertIndex++;
    }

    function bufferSize() public virtual pure returns (uint16) {
        return 30;
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
        return (histBuffer.baseRates, histBuffer.timestamps, histBuffer.insertIndex);
    }

    /**
     * @dev Update the historical buffer:
     * overwrites the oldest value with current one
     * and updates its timestamp
     */
    function updateRate() public offCooldown {
        uint16 iidx = histBuffer.insertIndex;
        histBuffer.timestamps[iidx] = block.timestamp;
        histBuffer.baseRates[iidx] = curve.get_virtual_price();
        histBuffer.insertIndex = uint16(iidx.add(1) % bufferSize());
    }

    /**
     * @dev Average rate is calculated by taking
     * the time-weighted average of the curve virtual prices.
     * Formula is given below:
     *
     *           (v + v_{n-1}) / 2 + sum_{i=1}^{n - 1} (v_i + v_{i-1}) / 2 * (t_i - t_{i-1})
     * avgRate = ---------------------------------------------------------------------------
     *                                           (t - t_0)
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
        uint256 bufferSizeNeeded = timeToCover.div(cooldownTime);
        require(bufferSizeNeeded <= bufferSize(), "CrvBaseRateOracle: Needed buffer size cannot exceed size limit");
        uint16 iidx = histBuffer.insertIndex;
        uint256 sum;
        uint256 totalTime;
        for (uint16 i = 1; i < bufferSizeNeeded; i++) {
            uint16 prevIdx = uint16(iidx.add(bufferSize()).sub(i).sub(1) % bufferSize());
            if (histBuffer.timestamps[prevIdx] == 0) {
                break;
            }
            uint16 idx = uint16(iidx.add(bufferSize()).sub(i) % bufferSize());
            uint256 dt = histBuffer.timestamps[idx].sub(histBuffer.timestamps[prevIdx]);
            sum = sum.add(histBuffer.baseRates[idx].add(histBuffer.baseRates[prevIdx]).mul(dt));
            totalTime = totalTime.add(dt);
        }
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        uint16 idx = uint16(iidx.add(bufferSize()).sub(1) % bufferSize());
        sum = sum.add(curCrvBaseRate.add(histBuffer.baseRates[idx]).mul(curTimestamp.sub(histBuffer.timestamps[idx])));
        totalTime = totalTime.add(curTimestamp.sub(histBuffer.timestamps[idx]));
        return sum.mul(100_00).div(2).div(totalTime);
    }

    function weeklyProfit() public view returns (int256) {
        int256 avgRate = int256(calculateAverageRate(7 days));
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return ((int256(curCrvBaseRate.mul(100_00)) - avgRate) * 7 days) / avgRate;
    }

    function monthlyProfit() public view returns (int256) {
        int256 avgRate = int256(calculateAverageRate(30 days));
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return ((int256(curCrvBaseRate.mul(100_00)) - avgRate) * 30 days) / avgRate;
    }

    function yearlyProfit() public view returns (int256) {
        int256 avgRate = int256(calculateAverageRate(365 days));
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return ((int256(curCrvBaseRate.mul(100_00)) - avgRate) * 365 days) / avgRate;
    }
}
