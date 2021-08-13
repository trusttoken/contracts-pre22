## `TrueFiPool2`



Lending pool which may use a strategy to store idle funds
Earn high interest rates on currency deposits through uncollateralized loans
Funds deposited in this pool are not fully liquid.
Exiting incurs an exit penalty depending on pool liquidity
After exiting, an account will need to wait for LoanTokens to expire and burn them
It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
Funds are managed through an external function to save gas on deposits

### `onlyLenderOrTrueCreditAgency()`



only TrueLender of CreditAgency can perform borrowing or repaying

### `joiningNotPaused()`



pool can only be joined when it's unpaused

### `sync()`

Sync values to avoid making expensive calls multiple times
Will set inSync to true, allowing getter functions to return cached values
Wipes cached values to save gas




### `concat(string a, string b) → string` (internal)



Helper function to concatenate two strings


### `initialize(contract ERC20 _token, contract ITrueLender2 _lender, contract ISAFU _safu, address __owner)` (external)





### `singleBorrowerInitialize(contract ERC20 _token, contract ITrueLender2 _lender, contract ISAFU _safu, address __owner, string borrowerName, string borrowerSymbol)` (external)



Initializer for single borrower pools

### `setPauseStatus(bool status)` (external)



Allow pausing of deposits in case of emergency


### `setSafuAddress(contract ISAFU _safu)` (external)



Change SAFU address

### `setCreditAgency(contract ITrueCreditAgency _creditAgency)` (external)





### `decimals() → uint8` (public)



Number of decimals for user-facing representations.
Delegates to the underlying pool token.

### `liquidValue() → uint256` (public)



Virtual value of liquid assets in the pool


### `strategyValue() → uint256` (public)



Value of funds deposited into the strategy denominated in underlying token


### `poolValue() → uint256` (public)



Calculate pool value in underlying token
"virtual price" of entire pool - LoanTokens, UnderlyingTokens, strategy value


### `deficitValue() → uint256` (public)



Return pool deficiency value, to be returned by safu


### `creditValue() → uint256` (public)



Return pool credit line value


### `loansValue() → uint256` (public)



Virtual value of loan assets in the pool
Will return cached value if inSync


### `ensureSufficientLiquidity(uint256 neededAmount)` (internal)



ensure enough tokens are available
Check if current available amount of `token` is enough and
withdraw remainder from strategy


### `setJoiningFee(uint256 fee)` (external)



set pool join fee


### `setBeneficiary(address newBeneficiary)` (external)



set beneficiary


### `join(uint256 amount)` (external)



Join the pool by depositing tokens


### `liquidExit(uint256 amount)` (external)



Exit pool only with liquid tokens
This function will only transfer underlying token but with a small penalty
Uses the sync() modifier to reduce gas costs of using strategy and lender


### `liquidExitPenalty(uint256 amount) → uint256` (public)



Penalty (in % * 100) applied if liquid exit is performed with this amount
returns BASIS_PRECISION (10000) if no penalty

### `integrateAtPoint(uint256 x) → uint256` (public)



Calculates integral of 5/(x+50)dx times 10000

### `averageExitPenalty(uint256 from, uint256 to) → uint256` (public)



Calculates average penalty on interval [from; to]


### `flush(uint256 amount)` (external)



Deposit idle funds into strategy


### `pull(uint256 minTokenAmount)` (external)



Remove liquidity from strategy


### `borrow(uint256 amount)` (external)



Remove liquidity from strategy if necessary and transfer to lender


### `repay(uint256 currencyAmount)` (external)



repay debt by transferring tokens to the contract


### `collectFees()` (external)



Claim fees from the pool

### `switchStrategy(contract ITrueStrategy newStrategy)` (external)



Switches current strategy to a new strategy


### `liquidate(contract ILoanToken2 loan)` (external)



Function called by SAFU when liquidation happens. It will transfer all tokens of this loan the SAFU

### `reclaimDeficit(contract ILoanToken2 loan)` (external)



Function called when loan's debt is repaid to SAFU, pool has a deficit value towards that loan

### `setOracle(contract ITrueFiPoolOracle newOracle)` (external)



Change oracle, can only be called by owner

### `currencyBalance() → uint256` (public)



Currency token balance


### `utilization() → uint256` (public)



Utilization of the pool


### `liquidRatio() → uint256` (public)



Ratio of liquid assets in the pool to the pool value.
Equals to 1 - utilization.


### `proFormaLiquidRatio(uint256 amount) → uint256` (external)



Ratio of liquid assets in the pool after lending


### `mint(uint256 depositedAmount) → uint256` (internal)





### `withToleratedSlippage(uint256 amount) → uint256` (internal)



Decrease provided amount percentwise by error


### `withToleratedStrategyLoss(uint256 amount) → uint256` (internal)



Decrease provided amount percentwise by error



### `JoiningFeeChanged(uint256 newFee)`



Emitted when fee is changed


### `BeneficiaryChanged(address newBeneficiary)`



Emitted when beneficiary is changed


### `OracleChanged(contract ITrueFiPoolOracle newOracle)`



Emitted when oracle is changed


### `Joined(address staker, uint256 deposited, uint256 minted)`



Emitted when someone joins the pool


### `Exited(address staker, uint256 amount)`



Emitted when someone exits the pool


### `Flushed(uint256 currencyAmount)`



Emitted when funds are flushed into the strategy


### `Pulled(uint256 minTokenAmount)`



Emitted when funds are pulled from the strategy


### `Borrow(address borrower, uint256 amount)`



Emitted when funds are borrowed from pool


### `Repaid(address payer, uint256 amount)`



Emitted when borrower repays the pool


### `Collected(address beneficiary, uint256 amount)`



Emitted when fees are collected


### `StrategySwitched(contract ITrueStrategy newStrategy)`



Emitted when strategy is switched


### `PauseStatusChanged(bool pauseStatus)`



Emitted when joining is paused or unpaused


### `SafuChanged(contract ISAFU newSafu)`



Emitted when SAFU address is changed


### `DeficitReclaimed(contract ILoanToken2 loan, uint256 deficit)`



Emitted when pool reclaims deficit from SAFU


### `CreditAgencyChanged(contract ITrueCreditAgency newCreditAgency)`



Emitted when Credit Agency address is changed


