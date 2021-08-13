## `TruSushiswapRewarder`





### `onlyMCV2()`






### `initialize(uint256 _rewardMultiplier, contract IERC20 _trustToken, address _MASTERCHEF_V2)` (external)



Initialize this contract with provided parameters


### `onSushiReward(uint256, address, address recipient, uint256 sushiAmount, uint256)` (external)



Hook called on sushi reward
Calculate token reward amount based on sushi reward amount

### `pendingTokens(uint256, address, uint256 sushiAmount) → contract IERC20[] rewardTokens, uint256[] rewardAmounts` (external)



Get pending token rewards
Calculate token reward amount based on sushi reward amount



