## `TrueMultiFarm`

Deposit liquidity tokens to earn TRU rewards over time


Staking pool where tokens are staked for TRU rewards
A Distributor contract decides how much TRU all farms in total can earn over time
Calling setShare() by owner decides ratio of rewards going to respective token farms
You can think of this contract as of a farm that is a distributor to the multiple other farms
A share of a farm in the multifarm is it's stake

### `update(contract IERC20 token)`



Update all rewards associated with the token and msg.sender

### `hasShares(contract IERC20 token)`



Is there any reward allocatiion for given token


### `staked(contract IERC20 token, address staker) → uint256` (external)



How much is staked by staker on token farm

### `initialize(contract ITrueDistributor _trueDistributor)` (public)



Initialize staking pool with a Distributor contract
The distributor contract calculates how much TRU rewards this contract
gets, and stores TRU for distribution.


### `stake(contract IERC20 token, uint256 amount)` (external)



Stake tokens for TRU rewards.
Also claims any existing rewards.


### `unstake(contract IERC20 token, uint256 amount)` (external)



Remove staked tokens


### `claim(contract IERC20[] tokens)` (external)



Claim TRU rewards

### `exit(contract IERC20[] tokens)` (external)



Unstake amount and claim rewards

### `setShares(contract IERC20[] tokens, uint256[] updatedShares)` (external)



Set shares for farms
Example: setShares([DAI, USDC], [1, 2]) will ensure that 33.(3)% of rewards will go to DAI farm and rest to USDC farm
If later setShares([DAI, TUSD], [2, 1]) will be called then shares of DAI will grow to 2, shares of USDC won't change and shares of TUSD will be 1
So this will give 40% of rewards going to DAI farm, 40% to USDC and 20% to TUSD


### `_unstake(contract IERC20 token, uint256 amount)` (internal)



Internal unstake function


### `_claim(contract IERC20 token)` (internal)



Internal claim function

### `claimable(contract IERC20 token, address account) → uint256` (external)



View to estimate the claimable reward for an account that is staking token


### `_pendingDistribution(contract IERC20 token) → uint256` (internal)





### `distribute()` (internal)



Distribute rewards from distributor and increase cumulativeRewardPerShare in Multifarm

### `_updateCumulativeRewardPerShare()` (internal)



This function must be called before any change of token share in multifarm happens (e.g. before shares.totalStaked changes)
This will also update cumulativeRewardPerToken after distribution has happened
1. Get total lifetime rewards as Balance of TRU plus total rewards that have already been claimed
2. See how much reward we got since previous update (R)
3. Increase cumulativeRewardPerToken by R/total shares

### `updateRewards(contract IERC20 token)` (internal)



Update rewards for the farm on token and for the staker.
The function must be called before any modification of staker's stake and to update values when claiming rewards

### `_updateTokenFarmRewards(contract IERC20 token)` (internal)



Update rewards data for the token farm - update all values associated with total available rewards for the farm inside multifarm

### `_updateClaimableRewardsForFarm(contract IERC20 token)` (internal)



Increase total claimable rewards for token farm in multifarm.
This function must be called before share of the token in multifarm is changed and to update total claimable rewards for the staker

### `_updateTotalRewards(contract IERC20 token)` (internal)



Update total reward for the farm
Get total farm reward as claimable rewards for the given farm plus total rewards claimed by stakers in the farm

### `_updateClaimableRewardsForStaker(contract IERC20 token)` (internal)



Update claimable rewards for the msg.sender who is staking this token
Increase claimable reward by the number that is
staker's stake times the change of cumulativeRewardPerToken for the given token since this function was previously called
This method must be called before any change of staker's stake


### `Stake(contract IERC20 token, address who, uint256 amountStaked)`



Emitted when an account stakes


### `Unstake(contract IERC20 token, address who, uint256 amountUnstaked)`



Emitted when an account unstakes


### `Claim(contract IERC20 token, address who, uint256 amountClaimed)`



Emitted when an account claims TRU rewards


