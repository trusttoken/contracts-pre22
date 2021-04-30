// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";

contract CrvBaseRateOracle {
    using SafeMath for uint256;
    uint8 public constant BUFFER_SIZE = 7;

    ICurve public curve;

    struct HistoricalRatesBuffer {
        uint256[BUFFER_SIZE] baseRates;
        uint256[BUFFER_SIZE] timestamps;
        uint8 insertIndex;
    }

    HistoricalRatesBuffer public histBuffer;

    constructor(ICurve _curve) public {
        curve = _curve;
    }

    function getHistBuffer() public view returns (uint256[BUFFER_SIZE] memory, uint256[BUFFER_SIZE] memory, uint8) {
        return (histBuffer.baseRates, histBuffer.timestamps, histBuffer.insertIndex);
    }

    function updateRate() public {
        uint8 iidx = histBuffer.insertIndex;
        histBuffer.timestamps[iidx] = block.timestamp;
        histBuffer.baseRates[iidx] = curve.get_virtual_price();
        histBuffer.insertIndex = (iidx + 1) % BUFFER_SIZE;
    }

    function calculateAverageRate() public view returns (uint256) {
        // Average rate is calculated based on formula below:
        //           v_n - v_1
        // avgRate = ---------
        //           t_n - t_1
        //
        // where v_n is the most recent rate, v_1 is the oldest rate,
        // t_n and t_1 are their timestamps respectively
        uint8 idxOfOldestRate = histBuffer.insertIndex;
        uint256 v_n = histBuffer.baseRates[(idxOfOldestRate - 1) % BUFFER_SIZE];
        uint256 v_1 = histBuffer.baseRates[idxOfOldestRate];
        uint256 t_n = histBuffer.timestamps[(idxOfOldestRate - 1) % BUFFER_SIZE];
        uint256 t_1 = histBuffer.timestamps[idxOfOldestRate];
        return (v_n.sub(v_1)).mul(100_00).div(t_n.sub(t_1));
    }

    // returns profit rates for week, month and year ahead
    function rate() public view returns (uint256, uint256, uint256) {
        require(histBuffer.timestamps[histBuffer.insertIndex] != 0, "CrvBaseRateOracle: histBuffer must be filled up");
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 immediateProfit = calculateAverageRate();
        uint256 weeklyProfit = immediateProfit.mul(7 days).div(curCrvBaseRate);
        uint256 monthlyProfit = immediateProfit.mul(30 days).div(curCrvBaseRate);
        uint256 yearlyProfit = immediateProfit.mul(365 days).div(curCrvBaseRate);
        return (weeklyProfit, monthlyProfit, yearlyProfit);
   }
}
