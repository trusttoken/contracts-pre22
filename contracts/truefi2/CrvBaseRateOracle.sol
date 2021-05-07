// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";

// prettier-ignore
contract CrvBaseRateOracle {
    using SafeMath for uint256;
    using SafeMath for uint8;

    ICurve public curve;

    struct HistoricalRatesBuffer {
        uint256[BUFFER_SIZE] baseRates;
        uint256[BUFFER_SIZE] timestamps;
        uint8 insertIndex;
    }

    HistoricalRatesBuffer public histBuffer;
    uint256 public cooldownTime;

    uint8 public constant BUFFER_SIZE = 7;

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

    function getHistBuffer() public view returns (uint256[BUFFER_SIZE] memory, uint256[BUFFER_SIZE] memory, uint8) {
        return (histBuffer.baseRates, histBuffer.timestamps, histBuffer.insertIndex);
    }

    function updateRate() public offCooldown {
        uint8 iidx = histBuffer.insertIndex;
        histBuffer.timestamps[iidx] = block.timestamp;
        histBuffer.baseRates[iidx] = curve.get_virtual_price();
        histBuffer.insertIndex = uint8(iidx.add(1) % BUFFER_SIZE);
    }

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

    function rate() public view returns (uint256, uint256, uint256) {
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 avgRate = calculateAverageRate();
        uint256 weeklyProfit = avgRate.mul(7 days).div(curCrvBaseRate);
        uint256 monthlyProfit = avgRate.mul(30 days).div(curCrvBaseRate);
        uint256 yearlyProfit = avgRate.mul(365 days).div(curCrvBaseRate);
        return (weeklyProfit, monthlyProfit, yearlyProfit);
    }
}
