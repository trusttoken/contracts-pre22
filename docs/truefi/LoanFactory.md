## `LoanFactory`

Deploy LoanTokens with this Contract


LoanTokens are deployed through a factory to ensure that all
LoanTokens adhere to the same contract code, rather than using an interface.


### `initialize(contract IERC20 _currencyToken)` (external)



Initialize this contract and set currency token


### `setLender()` (external)



sets lender address *

### `setLiquidator()` (external)



sets liquidator address *

### `createLoanToken(uint256 _amount, uint256 _term, uint256 _apy)` (external)



Deploy LoanToken with parameters



### `LoanTokenCreated(address contractAddress)`



Emitted when a LoanToken is created


