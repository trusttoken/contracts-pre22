// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";

// prettier-ignore
contract CrvBaseRateOracle {
    using SafeMath for uint256;

    ICurve public curve;

    struct HistoricalRatesBuffer {
        uint256[BUFFER_SIZE] baseRates;
        uint256[BUFFER_SIZE] timestamps;
        uint8 insertIndex;
    }

    HistoricalRatesBuffer public histBuffer;

    uint8 public constant BUFFER_SIZE = 7;

    constructor(ICurve _curve) public {
        curve = _curve;

        // fill the buffer
        uint256 curCrvBaseRate = curve.get_virtual_price();
        uint256 curTimestamp = block.timestamp;
        for (uint i = 0; i < BUFFER_SIZE; i++) {
            histBuffer.baseRates[i] = curCrvBaseRate;
            histBuffer.timestamps[i] = curTimestamp;
        }
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
        // Average rate is calculated by taking
        // the time-weighted average of the speeds
        // of virtual price changes.
        //
        // let 'd_{i,j}' be the speed of virtual price change:
        //           v_i - v_j
        // d_{i,j} = --------- , i != j
        //           t_i - t_j
        // where v_i, v_j are values of rates,
        // t_i and t_j are their timestamps respectively.
        //
        // To calculate time-weighted average one has to
        // multiply each element by respective amount time
        // and then divide the sum of the products
        // by the sum of those times.
        //
        // Average rate is calculated based on formula below:
        //           d_{n,n-1} * (t_n - t_{n-1}) + ... + d_{2,1} * (t_2 - t_1)
        // avgRate = --------------------------------------------------------- = (*)
        //                       (t_n - t_{n-1}) + ... + (t_2 - t_1)
        //
        // which can be simplified to:
        //       (v_n - v_{n-1}) + ... + (v_2 - v_1)
        // (*) = ----------------------------------- = (**)
        //       (t_n - t_{n-1}) + ... + (t_2 - t_1)
        //
        // which can be simplified even further to:
        //
        //        v_n - v_1
        // (**) = ---------
        //        t_n - t_1
        //
        // where v_n is the most recent rate, v_1 is the oldest rate,
        // t_n and t_1 are their timestamps respectively.
        //
        // For v_n and t_n we use current values
        // instead of the values stored in histBuffer
        // to be more sensitive to virtual price changes.
        uint256 v_n = curve.get_virtual_price();
        uint256 t_n = block.timestamp;
        uint256 v_1 = histBuffer.baseRates[histBuffer.insertIndex];
        uint256 t_1 = histBuffer.timestamps[histBuffer.insertIndex];
        // todo handle case when (v_n - v_1) < 0
        return (v_n.sub(v_1)).mul(100_00).div(t_n.sub(t_1));
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
