## `ITrueFiPool2`






### `initialize(contract ERC20 _token, contract ITrueLender2 _lender, contract ISAFU safu, address __owner)` (external)





### `singleBorrowerInitialize(contract ERC20 _token, contract ITrueLender2 _lender, contract ISAFU safu, address __owner, string borrowerName, string borrowerSymbol)` (external)





### `token() → contract ERC20` (external)





### `oracle() → contract ITrueFiPoolOracle` (external)





### `poolValue() → uint256` (external)





### `liquidRatio() → uint256` (external)



Ratio of liquid assets in the pool to the pool value

### `proFormaLiquidRatio(uint256 amount) → uint256` (external)



Ratio of liquid assets in the pool after lending


### `join(uint256 amount)` (external)



Join the pool by depositing tokens


### `borrow(uint256 amount)` (external)



borrow from pool
1. Transfer TUSD to sender
2. Only lending pool should be allowed to call this

### `repay(uint256 currencyAmount)` (external)



pay borrowed money back to pool
1. Transfer TUSD from sender
2. Only lending pool should be allowed to call this

### `liquidate(contract ILoanToken2 loan)` (external)



SAFU buys LoanTokens from the pool


