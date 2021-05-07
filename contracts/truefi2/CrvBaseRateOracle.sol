// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";

// prettier-ignore
contract CrvBaseRateOracle {
    using SafeMath for uint256;
    using SafeMath for uint8;

    ICurve public curve;

    // A cyclic buffer structure for storing historical values.
    // insertIndex points to the place where the next value
    // should be inserted.
    struct HistoricalRatesBuffer {
        uint256[BUFFER_SIZE] baseRates;
        uint256[BUFFER_SIZE] timestamps;
        uint8 insertIndex;
    }
    HistoricalRatesBuffer public histBuffer;

    // A fixed amount of time to wait
    // to be able to update the historical buffer
    uint256 public cooldownTime;

    uint8 public constant BUFFER_SIZE = 7;

    /**
     * @dev Throws if cooldown is on when updating the historical buffer
     */
    modifier offCooldown() {
        uint256 lastUpdated = histBuffer.timestamps[histBuffer.insertIndex.add(BUFFER_SIZE).sub(1) % BUFFER_SIZE];
        require(now >= lastUpdated.add(cooldownTime), "CrvBaseRateOracle: Buffer on cooldown");
        _;
    }

    constructor(ICurve _curve) public {
        curve = _curve;
        cooldownTime = 1 days;

        // fill the buffer
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        for (uint8 i = 0; i < BUFFER_SIZE; i++) {
            histBuffer.baseRates[i] = curCrvBaseRate;
            histBuffer.timestamps[i] = curTimestamp;
        }
        // prevent first calculateAverageRate call from division by zero
        histBuffer.timestamps[0] = histBuffer.timestamps[0].sub(1);
    }

    /**
     * @dev Helper function to get contents of the historical buffer
     */
    function getHistBuffer() public view returns (uint256[BUFFER_SIZE] memory, uint256[BUFFER_SIZE] memory, uint8) {
        return (histBuffer.baseRates, histBuffer.timestamps, histBuffer.insertIndex);
    }

    /**
     * @dev Update the historical buffer:
     * overwrites the oldest value with current one
     * and updates its timestamp
     */
    function updateRate() public offCooldown {
        uint8 iidx = histBuffer.insertIndex;
        histBuffer.timestamps[iidx] = block.timestamp;
        histBuffer.baseRates[iidx] = curve.get_virtual_price();
        histBuffer.insertIndex = uint8(iidx.add(1) % BUFFER_SIZE);
    }

    /**
     * @dev Average rate is calculated by taking
     * the time-weighted average of the curve virtual prices.
     * Formula is given below:
     *
     *           sum_{i=1}^{n - 1} v_i * (t_i - t_{i-1})
     * avgRate = ---------------------------------------
     *                      (t_{n-1} - t_0)
     *
     * where v_i, t_i are values of the prices and their respective timestamps
     * stored in the historical buffer. Index n-1 corresponds to the most
     * recent values and index 0 to the oldest ones.
     * @return Average rate in percentage with precision
     */
    function calculateAverageRate() public view returns (uint256) {
        uint8 iidx = histBuffer.insertIndex;
        uint256 sum;
        for (uint8 i = 1; i < BUFFER_SIZE; i++) {
            uint8 idx = uint8(iidx.add(i) % BUFFER_SIZE);
            uint8 prevIdx = uint8(iidx.add(i).sub(1) % BUFFER_SIZE);
            uint256 dt = histBuffer.timestamps[idx].sub(histBuffer.timestamps[prevIdx]);
            sum = sum.add(histBuffer.baseRates[idx].mul(dt));
        }
        // amount of time covered by the buffer
        uint256 totalTime = histBuffer.timestamps[iidx.add(BUFFER_SIZE).sub(1) % BUFFER_SIZE]
        .sub(histBuffer.timestamps[iidx]);
        return sum.mul(100_00).div(totalTime);
    }

    function weeklyMonthlyYearlyProfit() public view returns (uint256, uint256, uint256) {
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 avgRate = calculateAverageRate();
        uint256 weeklyProfit = avgRate.mul(7 days).div(curCrvBaseRate);
        uint256 monthlyProfit = avgRate.mul(30 days).div(curCrvBaseRate);
        uint256 yearlyProfit = avgRate.mul(365 days).div(curCrvBaseRate);
        return (weeklyProfit, monthlyProfit, yearlyProfit);
    }
}
