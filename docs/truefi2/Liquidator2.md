## `Liquidator2`

Liquidate LoanTokens with this Contract


When a Loan becomes defaulted, Liquidator allows to
compensate pool participants, by transferring some of TRU to the pool


### `initialize(contract IStakingPool _stkTru, contract IERC20 _tru, contract ILoanFactory2 _loanFactory, address _SAFU)` (public)



Initialize this contract

### `setAssurance(address _SAFU)` (external)



Set a new SAFU address


### `setFetchMaxShare(uint256 newShare)` (external)



Set new max fetch share


### `setTokenApproval(address token, bool status)` (external)



Change whitelist status of a token for liquidations


### `liquidate(contract ILoanToken2 loan)` (external)



Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
then transfers tru to TrueFiPool as compensation


### `getAmountToWithdraw(uint256 deficit, contract ITrueFiPoolOracle oracle) → uint256` (internal)



Calculate amount of tru to be withdrawn from staking pool (not more than preset share)



### `FetchMaxShareChanged(uint256 newShare)`



Emitted fetch max share is changed


### `WhitelistStatusChanged(address token, bool status)`



Emitted when whitelist status for a token changes


### `Liquidated(contract ILoanToken2 loan, uint256 defaultedValue, uint256 withdrawnTru)`



Emitted when a loan gets liquidated


### `AssuranceChanged(address SAFU)`



Emitted when SAFU is changed


