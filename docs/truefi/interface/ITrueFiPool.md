## `ITrueFiPool`

TruePool is an ERC20 which represents a share of a pool
This contract can be used to wrap opportunities to be compatible
with TrueFi and allow users to directly opt-in through the TUSD contract
Each TruePool is also a staking opportunity for TRU




### `currencyToken() → contract IERC20` (external)



pool token (TUSD)

### `join(uint256 amount)` (external)



join pool
1. Transfer TUSD from sender
2. Mint pool tokens based on value to sender

### `borrow(uint256 amount, uint256 fee)` (external)



borrow from pool
1. Transfer TUSD to sender
2. Only lending pool should be allowed to call this

### `repay(uint256 amount)` (external)



join pool
1. Transfer TUSD from sender
2. Only lending pool should be allowed to call this


