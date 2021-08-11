// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SpotBaseRateOracle} from "./SpotBaseRateOracle.sol";

contract TimeAveragedBaseRateOracle is UpgradeableClaimable {
    using SafeMath for uint256;

    uint16 public constant BUFFER_SIZE = 365 + 1;

    SpotBaseRateOracle public spotOracle;
    address public asset;

    // A fixed amount of time to wait
    // to be able to update the totalsBuffer
    uint256 public cooldownTime;

    // A cyclic buffer structure for storing running total (cumulative sum)
    // values and their respective timestamps.
    // currIndex points to the previously inserted value.
    struct RunningTotalsBuffer {
        uint256[BUFFER_SIZE] runningTotals;
        uint256[BUFFER_SIZE] timestamps;
        uint16 currIndex;
    }

    RunningTotalsBuffer public totalsBuffer;

    /**
     * @dev Throws if cooldown is on when updating the totalsBuffer
     */
    modifier offCooldown() {
        require(isOffCooldown(), "TimeAveragedBaseRateOracle: Buffer on cooldown");
        _;
    }

    function initialize(
        SpotBaseRateOracle _spotOracle,
        address _asset,
        uint256 _cooldownTime
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);
        spotOracle = _spotOracle;
        asset = _asset;
        cooldownTime = _cooldownTime;

        totalsBuffer.timestamps[0] = block.timestamp;
    }

    function bufferSize() public virtual pure returns (uint16) {
        return BUFFER_SIZE;
    }

    function isOffCooldown() public view returns (bool) {
        // get the last timestamp written into the buffer
        uint256 lastWritten = totalsBuffer.timestamps[totalsBuffer.currIndex];
        return block.timestamp >= lastWritten.add(cooldownTime);
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

    /**
     * @dev Update the totalsBuffer:
     * Gets current variable borrow apy from a collateralized lending protocol
     * for chosen asset and writes down new total running value.
     * If the buffer is filled overwrites the oldest value
     * with a new one and updates its timestamp.
     */
    function update() public offCooldown {
        uint16 _currIndex = totalsBuffer.currIndex;
        uint16 nextIndex = (_currIndex + 1) % bufferSize();
        uint256 apy = spotOracle.getRate(asset);
        uint256 nextTimestamp = block.timestamp;
        uint256 dt = nextTimestamp.sub(totalsBuffer.timestamps[_currIndex]);
        totalsBuffer.runningTotals[nextIndex] = totalsBuffer.runningTotals[_currIndex].add(apy.mul(dt));
        totalsBuffer.timestamps[nextIndex] = nextTimestamp;
        totalsBuffer.currIndex = nextIndex;
    }

    /**
     * @dev Average apy is calculated by taking
     * the time-weighted average of the borrowing apys.
     * Essentially formula given below is used:
     *
     *           sum_{i=1}^{n} v_i * (t_i - t_{i-1})
     * avgAPY = ------------------------------------
     *                      t_n - t_0
     *
     * where v_i, t_i are values of the apys and their respective timestamps.
     * Index n corresponds to the most recent values and index 0 to the oldest ones.
     *
     * To avoid costly computations in a loop an optimization is used:
     * Instead of directly storing apys we store calculated numerators from the formula above.
     * This gives us most of the job done for every calculation.
     *
     * @param numberOfValues How many values of totalsBuffer should be involved in calculations.
     * @return Average apy.
     */
    function calculateAverageAPY(uint16 numberOfValues) public view returns (uint256) {
        require(numberOfValues > 0, "TimeAveragedBaseRateOracle: Number of values should be greater than 0");
        require(numberOfValues < bufferSize(), "TimeAveragedBaseRateOracle: Number of values should be less than buffer size");

        uint16 _currIndex = totalsBuffer.currIndex;
        uint16 startIndex = (_currIndex + bufferSize() - numberOfValues) % bufferSize();

        if (totalsBuffer.timestamps[startIndex] == 0) {
            require(_currIndex > 0, "TimeAveragedBaseRateOracle: Cannot use buffer before any update call");
            startIndex = 0;
        }

        uint256 diff = totalsBuffer.runningTotals[_currIndex].sub(totalsBuffer.runningTotals[startIndex]);
        uint256 dt = totalsBuffer.timestamps[_currIndex].sub(totalsBuffer.timestamps[startIndex]);
        return diff.div(dt);
    }

    /**
     * @dev apy based on last 7 entries in totalsBuffer.
     */
    function getWeeklyAPY() public view returns (uint256) {
        return calculateAverageAPY(7);
    }

    /**
     * @dev apy based on last 30 entries in totalsBuffer.
     */
    function getMonthlyAPY() public view returns (uint256) {
        return calculateAverageAPY(30);
    }

    /**
     * @dev apy based on last 365 entries in totalsBuffer.
     */
    function getYearlyAPY() public view returns (uint256) {
        return calculateAverageAPY(365);
    }
}
