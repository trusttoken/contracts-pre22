## `TimeAveragedBaseRateOracle`



Used to find the time averaged interest rate for TrueFi secured lending rate
- Uses a spot oracle to capture data points over time
- Finds and stores time-weighted average of borrow APYs

### `offCooldown()`



Throws if cooldown is on when updating the totalsBuffer


### `initialize(contract SpotBaseRateOracle _spotOracle, address _asset, uint256 _cooldownTime)` (external)



initialize

### `bufferSize() → uint16` (public)



Get buffer size for this oracle

### `setSpotOracle(contract SpotBaseRateOracle newSpotOracle)` (public)



Set spot oracle to `newSpotOracle`

### `isOffCooldown() → bool` (public)



Return true if this contract is cooled down from the last update

### `getTotalsBuffer() → uint256[366], uint256[366], uint16` (public)



Helper function to get contents of the totalsBuffer

### `update()` (public)



Update the totalsBuffer:
Gets current variable borrow apy from a collateralized lending protocol
for chosen asset and writes down new total running value.
If the buffer is filled overwrites the oldest value
with a new one and updates its timestamp.

### `calculateAverageAPY(uint16 numberOfValues) → uint256` (public)



Average apy is calculated by taking
the time-weighted average of the borrowing apys.
Essentially formula given below is used:
sum_{i=1}^{n} v_i * (t_i - t_{i-1})
avgAPY = ------------------------------------
t_n - t_0
where v_i, t_i are values of the apys and their respective timestamps.
Index n corresponds to the most recent values and index 0 to the oldest ones.
To avoid costly computations in a loop an optimization is used:
Instead of directly storing apys we store calculated numerators from the formula above.
This gives us most of the job done for every calculation.


### `getWeeklyAPY() → uint256` (public)



apy based on last 7 entries in totalsBuffer.

### `getMonthlyAPY() → uint256` (public)



apy based on last 30 entries in totalsBuffer.

### `getYearlyAPY() → uint256` (public)



apy based on last 365 entries in totalsBuffer.


### `SpotBaseRateOracleChanged(contract SpotBaseRateOracle newSpotOracle)`





