// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";

// prettier-ignore
contract CrvBaseRateOracle {
    using SafeMath for uint256;
    using SafeMath for uint16;

    ICurve public curve;

    // A cyclic buffer structure for storing historical values.
    // insertIndex points to the place where the next value
    // should be inserted.
    struct HistoricalRatesBuffer {
        uint256[BUFFER_SIZE] baseRates;
        uint256[BUFFER_SIZE] timestamps;
        uint16 insertIndex;
    }
    HistoricalRatesBuffer public histBuffer;

    // A fixed amount of time to wait
    // to be able to update the historical buffer
    uint256 public cooldownTime;

    uint16 public constant BUFFER_SIZE = 7;

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
        for (uint16 i = 0; i < BUFFER_SIZE; i++) {
            histBuffer.baseRates[i] = curCrvBaseRate;
            histBuffer.timestamps[i] = curTimestamp;
        }
        // prevent first calculateAverageRate call from division by zero
        histBuffer.timestamps[0] = histBuffer.timestamps[0].sub(1);
    }

    /**
     * @dev Helper function to get contents of the historical buffer
     */
    function getHistBuffer() public view returns (uint256[BUFFER_SIZE] memory, uint256[BUFFER_SIZE] memory, uint16) {
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
        histBuffer.insertIndex = uint16(iidx.add(1) % BUFFER_SIZE);
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
     * Notice that whether we are going to use the whole buffer or not
     * depends on value of timeToCover parameter.
     * @param timeToCover For how much time average should be calculated
     * @return Average rate in percentage with precision
     */
    function calculateAverageRate(uint256 timeToCover) public view returns (uint256) {
        require(
            1 days <= timeToCover && timeToCover <= 365 days,
            "CrvBaseRateOracle: Expected amount of time in range 1 to 365 days"
        );
        // estimate how much buffer we need to use
        uint256 bufferSizeNeeded = timeToCover.div(cooldownTime);
        require(
            bufferSizeNeeded <= BUFFER_SIZE,
            "CrvBaseRateOracle: Needed buffer size cannot exceed size limit"
        );
        uint16 iidx = histBuffer.insertIndex;
        uint256 sum;
        for (uint16 i = 1; i < bufferSizeNeeded; i++) {
            uint16 idx = uint16(iidx.add(BUFFER_SIZE).sub(i) % BUFFER_SIZE);
            uint16 prevIdx = uint16(iidx.add(BUFFER_SIZE).sub(i).sub(1) % BUFFER_SIZE);
            uint256 dt = histBuffer.timestamps[idx].sub(histBuffer.timestamps[prevIdx]);
            sum = sum.add(histBuffer.baseRates[idx].mul(dt));
        }
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        uint16 idx = iidx.add(BUFFER_SIZE).sub(1) % BUFFER_SIZE;
        sum += curCrvBaseRate.mul(curTimestamp.sub(histBuffer.timestamps[idx]));
        // amount of time covered by the buffer
        uint256 totalTime = curTimestamp.sub(histBuffer.timestamps[iidx]);
        return sum.mul(100_00).div(totalTime);
    }

    function weeklyProfit() public view returns (uint256) {
        uint256 avgRate = calculateAverageRate(7 days);
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return avgRate.mul(7 days).div(curCrvBaseRate);
    }

    function monthlyProfit() public view returns (uint256) {
        uint256 avgRate = calculateAverageRate(30 days);
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return avgRate.mul(30 days).div(curCrvBaseRate);
    }

    function yearlyProfit() public view returns (uint256) {
        uint256 avgRate = calculateAverageRate(365 days);
        uint256 curCrvBaseRate = curve.get_virtual_price();
        return avgRate.mul(365 days).div(curCrvBaseRate);
    }
}
