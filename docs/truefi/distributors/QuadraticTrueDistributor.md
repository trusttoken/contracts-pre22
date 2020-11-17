## `QuadraticTrueDistributor`

Distributes TRU to TrueFarm farms


This contract distributes trustTokens starting from `startingBlock` for the next 10 million block (roughly 4.5 years)
The tokens will be distributed according to the declining quadratic curve
For each block `DISTRIBUTION_FACTOR*(10M-n)^2` TRU is awarded where `n` if a block number since `startingBlock`
`DISTRIBUTION_FACTOR` has been selected so that 536,500,000 (39% of total TRU supply) will be awarded in total


### `getDistributionFactor() → uint256` (public)





### `getTotalBlocks() → uint256` (public)





### `initialize(uint256 _startingBlock, contract IERC20 _trustToken)` (public)





### `distribute(address farm)` (public)

transfer all rewards since previous `distribute` call to the `farm`.
Transferred reward is proportional to the stake of the farm



### `empty()` (public)





### `normalise(uint256 amount) → uint256` (public)





### `transfer(address fromFarm, address toFarm, uint256 sharesAmount)` (external)





### `getShares(address farm) → uint256` (external)





### `getLastDistributionBlock(address farm) → uint256` (external)





### `adjustInterval(uint256 fromBlock, uint256 toBlock) → uint256, uint256` (internal)





### `reward(uint256 fromBlock, uint256 toBlock) → uint256` (public)

Reward from `fromBlock` to `toBlock`.



### `rewardFormula(uint256 fromBlock, uint256 toBlock) → uint256` (internal)



Calculates sum of rewards from `fromBlock` to `toBlock`.
Uses the fact that sum of n first squares is calculated by n(n+1)(2n+1)/6


### `squareSumTimes6(uint256 n) → uint256` (internal)



Calculate square sum * 6 to find area under the curve



