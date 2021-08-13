## `ITrueStrategy`






### `deposit(uint256 amount)` (external)



put `amount` of tokens into the strategy
As a result of the deposit value of the strategy should increase by at least 98% of amount

### `withdraw(uint256 minAmount)` (external)



pull at least `minAmount` of tokens from strategy and transfer to the pool

### `withdrawAll()` (external)



withdraw everything from strategy
As a result of calling withdrawAll(),at least 98% of strategy's value should be transferred to the pool
Value must become 0

### `value() → uint256` (external)



value evaluated to Pool's tokens


