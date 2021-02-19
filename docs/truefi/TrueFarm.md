## `TrueFarm`

Deposit liquidity tokens to earn TRU rewards over time


Staking pool where tokens are staked for TRU rewards
A Distributor contract decides how much TRU a farm can earn over time

### `update()`



Update state and get TRU from distributor


### `initialize(contract IERC20 _stakingToken, contract ITrueDistributor _trueDistributor, string _name)` (public)



Initalize staking pool with a Distributor contract
The distributor contract calculates how much TRU rewards this contract
gets, and stores TRU for distribution.


### `stake(uint256 amount)` (external)



Stake tokens for TRU rewards.
Also claims any existing rewards.


### `_unstake(uint256 amount)` (internal)



Internal unstake function


### `_claim()` (internal)



Internal claim function

### `unstake(uint256 amount)` (external)



Remove staked tokens


### `claim()` (external)



Claim TRU rewards

### `exit(uint256 amount)` (external)



Unstake amount and claim rewards


### `claimable(address account) → uint256` (external)



View to estimate the claimable reward for an account



### `Stake(address who, uint256 amountStaked)`



Emitted when an account stakes


### `Unstake(address who, uint256 amountUnstaked)`



Emitted when an account unstakes


### `Claim(address who, uint256 amountClaimed)`



Emitted when an account claims TRU rewards


