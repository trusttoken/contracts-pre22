// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITruPriceOracle} from "../interface/ITruPriceOracle.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title TimeAveragedTruPriceOracle
 * @dev Used to find the time averaged interest rate for TrueFi secured lending rate
 * - Uses a spot oracle to capture data points over time
 * - Finds and stores time-weighted average of borrow APYs
 */
contract TimeAveragedTruPriceOracle is ITruPriceOracle, UpgradeableClaimable {
    using SafeMath for uint256;

    uint16 public constant BUFFER_SIZE = 365 + 1;
    uint64 public constant TIME_WINDOW = 7 days;

    // A cyclic buffer structure for storing running total (cumulative sum)
    // values and their respective timestamps.
    // currIndex points to the previously inserted value.
    struct RunningTotalsBuffer {
        uint256[BUFFER_SIZE] runningTotals;
        uint256[BUFFER_SIZE] timestamps;
        uint16 currIndex;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    AggregatorV3Interface public truPriceFeed;

    // A fixed amount of time to wait
    // to be able to update the totalsBuffer
    uint256 public cooldownTime;

    RunningTotalsBuffer public totalsBuffer;

    // ======= STORAGE DECLARATION END ===========

    event AggregatorChanged(AggregatorV3Interface newAggregator);

    /**
     * @dev Throws if cooldown is on when updating the totalsBuffer
     */
    modifier offCooldown() {
        require(isOffCooldown(), "TimeAveragedTruPriceOracle: Buffer on cooldown");
        _;
    }

    /// @dev initialize
    function initialize(AggregatorV3Interface _truPriceFeed, uint256 _cooldownTime) external initializer {
        UpgradeableClaimable.initialize(msg.sender);
        truPriceFeed = _truPriceFeed;
        cooldownTime = _cooldownTime;

        totalsBuffer.timestamps[0] = block.timestamp;
    }

    /// @dev Get buffer size for this oracle
    function bufferSize() public pure virtual returns (uint16) {
        return BUFFER_SIZE;
    }

    /// @dev Set spot oracle to `newSpotOracle`
    function setAggregator(AggregatorV3Interface newTruPriceFeed) public onlyOwner {
        truPriceFeed = newTruPriceFeed;
        emit AggregatorChanged(newTruPriceFeed);
    }

    /// @dev Return true if this contract is cooled down from the last update
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

    function safeUint(int256 value) internal pure returns (uint256) {
        require(value >= 0, "TimeAveragePriceOracle: uint underflow");
        return uint256(value);
    }

    /**
     * @dev return the latest price for TRU/USD with 8 decimals places
     * @return TRU/USD price
     */
    function getLatestTruPrice() public view returns (uint256) {
        (, int256 price, , , ) = truPriceFeed.latestRoundData();
        return safeUint(price);
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
        uint256 apy = getLatestTruPrice();
        uint256 nextTimestamp = block.timestamp;
        uint256 dt = nextTimestamp.sub(totalsBuffer.timestamps[_currIndex]);
        totalsBuffer.runningTotals[nextIndex] = totalsBuffer.runningTotals[_currIndex].add(apy.mul(dt));
        totalsBuffer.timestamps[nextIndex] = nextTimestamp;
        totalsBuffer.currIndex = nextIndex;
    }

    /**
     * @dev Average price is calculated by taking
     * the time-weighted average of the borrowing prices.
     * Essentially formula given below is used:
     *
     *           sum_{i=1}^{n} v_i * (t_i - t_{i-1})
     * avgAPY = ------------------------------------
     *                      t_n - t_0
     *
     * where v_i, t_i are values of the prices and their respective timestamps.
     * Index n corresponds to the most recent values and index 0 to the oldest ones.
     *
     * To avoid costly computations in a loop an optimization is used:
     * Instead of directly storing prices we store calculated numerators from the formula above.
     * This gives us most of the job done for every calculation.
     *
     * @param numberOfValues How many values of totalsBuffer should be involved in calculations.
     * @return Average price.
     */
    function calculateAveragePrice(uint16 numberOfValues) public view returns (uint256) {
        require(numberOfValues > 0, "TimeAveragedTruPriceOracle: Number of values should be greater than 0");
        require(numberOfValues < bufferSize(), "TimeAveragedTruPriceOracle: Number of values should be less than buffer size");

        uint16 _currIndex = totalsBuffer.currIndex;
        uint16 startIndex = (_currIndex + bufferSize() - numberOfValues) % bufferSize();

        if (totalsBuffer.timestamps[startIndex] == 0) {
            require(_currIndex > 0, "TimeAveragedTruPriceOracle: Cannot use buffer before any update call");
            startIndex = 0;
        }

        uint256 diff = totalsBuffer.runningTotals[_currIndex].sub(totalsBuffer.runningTotals[startIndex]);
        uint256 dt = totalsBuffer.timestamps[_currIndex].sub(totalsBuffer.timestamps[startIndex]);
        return diff.div(dt);
    }

    function getWeeklyPrice() public view returns (uint256) {
        uint16 entries = uint16(TIME_WINDOW / cooldownTime);
        return calculateAveragePrice(entries);
    }

    /// @dev TRU to USD with 18 decimals
    function truToUsd(uint256 tokenAmount) external view override returns (uint256) {
        // 10^8 * 10^8 * 10^2 = 10^18
        return tokenAmount.mul(getWeeklyPrice()).mul(100);
    }
}
