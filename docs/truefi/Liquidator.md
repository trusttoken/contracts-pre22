## `Liquidator`

Liquidate LoanTokens with this Contract


When a Loan becomes defaulted, Liquidator allows to
compensate pool participants, by transfering some of TRU to the pool


### `initialize(contract ITrueFiPool _pool, contract IStakingPool _stkTru, contract IERC20 _tru, contract ITruPriceOracle _oracle, contract ILoanFactory _factory)` (public)



Initialize this contract

### `setFetchMaxShare(uint256 newShare)` (external)



Set new max fetch share


### `setOracle(contract ITruPriceOracle newOracle)` (external)



Change oracle


### `liquidate(contract ILoanToken loan)` (external)



Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
then transfers tru to TrueFiPool as compensation


### `getAmountToWithdraw(uint256 deficit) → uint256` (internal)



Calculate amount of tru to be withdrawn from staking pool (not more than preset share)



### `FetchMaxShareChanged(uint256 newShare)`



Emitted fetch max share is changed


### `OracleChanged(contract ITruPriceOracle newOracle)`



Emitted when oracle is changed


### `Liquidated(contract ILoanToken loan)`



Emitted when a loan gets liquidated


