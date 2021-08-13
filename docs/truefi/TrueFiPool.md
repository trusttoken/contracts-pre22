## `TrueFiPool`



Lending pool which uses curve.fi to store idle funds
Earn high interest rates on currency deposits through uncollateralized loans
Funds deposited in this pool are not fully liquid. Liquidity
Exiting incurs an exit penalty depending on pool liquidity
After exiting, an account will need to wait for LoanTokens to expire and burn them
It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
Funds are managed through an external function to save gas on deposits

### `onlyLender()`



only lender can perform borrowing or repaying

### `joiningNotPaused()`



pool can only be joined when it's unpaused

### `onlyOwnerOrManager()`



only lender can perform borrowing or repaying

### `exchangeProtector(uint256 expectedGain, contract IERC20 _token)`



ensure than as a result of running a function,
balance of `token` increases by at least `expectedGain`

### `sync()`

Sync values to avoid making expensive calls multiple times
Will set inSync to true, allowing getter functions to return cached values
Wipes cached values to save gas




### `updateNameAndSymbolToLegacy()` (public)





### `borrow(uint256 amount)` (external)



support borrow function from pool V2

### `currencyToken() → contract IERC20` (public)



get currency token address


### `setLender2(contract ITrueLender2 lender2)` (public)



set TrueLenderV2

### `setFundsManager(address newFundsManager)` (public)



set funds manager address

### `setTruOracle(contract ITrueFiPoolOracle newOracle)` (public)



set TrueFi price oracle token address


### `setCrvOracle(contract ICrvPriceOracle newOracle)` (public)



set CRV price oracle token address


### `setPauseStatus(bool status)` (external)



Allow pausing of deposits in case of emergency


### `setSafuAddress(contract ISAFU _safu)` (external)



Change SAFU address

### `crvBalance() → uint256` (public)



Get total balance of CRV tokens


### `yTokenBalance() → uint256` (public)



Get total balance of curve.fi pool tokens


### `yTokenValue() → uint256` (public)



Virtual value of yCRV tokens in the pool
Will return sync value if inSync


### `crvValue() → uint256` (public)



Price of CRV in USD


### `liquidValue() → uint256` (public)



Virtual value of liquid assets in the pool


### `deficitValue() → uint256` (public)



Return pool deficiency value, to be returned by safu


### `poolValue() → uint256` (public)



Calculate pool value in TUSD
"virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens


### `loansValue() → uint256` (public)



Virtual value of loan assets in the pool
Will return cached value if inSync


### `ensureEnoughTokensAreAvailable(uint256 neededAmount)` (internal)



ensure enough curve.fi pool tokens are available
Check if current available amount of TUSD is enough and
withdraw remainder from gauge


### `setJoiningFee(uint256 fee)` (external)



set pool join fee


### `join(uint256 amount)` (external)



Join the pool by depositing currency tokens


### `liquidExit(uint256 amount)` (external)



Exit pool only with liquid tokens
This function will withdraw TUSD but with a small penalty
Uses the sync() modifier to reduce gas costs of using curve


### `flush(uint256 currencyAmount)` (external)



Deposit idle funds into curve.fi pool and stake in gauge
Called by owner to help manage funds in pool and save on gas for deposits


### `pull(uint256 yAmount, uint256 minCurrencyAmount)` (external)



Remove liquidity from curve


### `borrow(uint256 amount, uint256 fee)` (public)



Remove liquidity from curve if necessary and transfer to lender


### `removeLiquidityFromCurve(uint256 amountToWithdraw)` (internal)





### `repay(uint256 currencyAmount)` (external)



repay debt by transferring tokens to the contract


### `collectCrv()` (external)



Collect CRV tokens minted by staking at gauge

### `sellCrv(uint256 amountIn, uint256 amountOutMin, address[] path)` (public)



Sell collected CRV on Uniswap
- Selling CRV is managed by the contract owner
- Calculations can be made off-chain and called based on market conditions
- Need to pass path of exact pairs to go through while executing exchange
For example, CRV -> WETH -> TUSD


### `collectFees(address beneficiary)` (external)



Claim fees from the pool


### `liquidate(contract ILoanToken2 loan)` (external)



Function called by SAFU when liquidation happens. It will transfer all tokens of this loan the SAFU

### `calcTokenAmount(uint256 currencyAmount) → uint256` (public)

Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
Can be used to control slippage
Called in flush() function




### `currencyBalance() → uint256` (public)



Currency token balance


### `mint(uint256 depositedAmount) → uint256` (internal)





### `conservativePriceEstimation(uint256 price) → uint256` (internal)



Calculate price minus max percentage of slippage during exchange
This will lead to the pool value become a bit undervalued
compared to the oracle price but will ensure that the value doesn't drop
when token exchanges are performed.


### `TruOracleChanged(contract ITrueFiPoolOracle newOracle)`



Emitted when TrueFi oracle was changed


### `CrvOracleChanged(contract ICrvPriceOracle newOracle)`



Emitted when CRV oracle was changed


### `FundsManagerChanged(address newManager)`



Emitted when funds manager is changed


### `JoiningFeeChanged(uint256 newFee)`



Emitted when fee is changed


### `Joined(address staker, uint256 deposited, uint256 minted)`



Emitted when someone joins the pool


### `Exited(address staker, uint256 amount)`



Emitted when someone exits the pool


### `Flushed(uint256 currencyAmount)`



Emitted when funds are flushed into curve.fi


### `Pulled(uint256 yAmount)`



Emitted when funds are pulled from curve.fi


### `Borrow(address borrower, uint256 amount, uint256 fee)`



Emitted when funds are borrowed from pool


### `Repaid(address payer, uint256 amount)`



Emitted when borrower repays the pool


### `Collected(address beneficiary, uint256 amount)`



Emitted when fees are collected


### `PauseStatusChanged(bool pauseStatus)`



Emitted when joining is paused or unpaused


### `SafuChanged(contract ISAFU newSafu)`



Emitted when SAFU address is changed


