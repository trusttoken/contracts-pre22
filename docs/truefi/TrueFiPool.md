## `TrueFiPool`



Lending pool which uses curve.fi to store idle funds
Earn high interest rates on currency deposits through uncollateralized loans
Funds deposited in this pool are not fully liquid. Luqidity
Exiting the pool has 2 options:
- withdraw a basket of LoanTokens backing the pool
- take an exit penallty depending on pool liquidity
After exiting, an account will need to wait for LoanTokens to expire and burn them
It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
Funds are managed through an external function to save gas on deposits

### `onlyLender()`



only lender can perform borrowing or repaying

### `joiningNotPaused()`



pool can only be joined when it's unpaused

### `onlyOwnerOrManager()`



only lender can perform borrowing or repaying

### `sync()`

Sync values to avoid making expensive calls multiple times
Will set inSync to true, allowing getter functions to return cached values
Wipes cached values to save gas




### `initialize(contract ICurvePool __curvePool, contract ICurveGauge __curveGauge, contract IERC20 __currencyToken, contract ITrueLender __lender, contract IUniswapRouter __uniRouter, contract IERC20 __stakeToken, contract ITruPriceOracle __oracle)` (public)



Initialize pool


### `currencyToken() → contract IERC20` (public)



get currency token address


### `stakeToken() → contract IERC20` (public)



get stake token address


### `setStakeToken(contract IERC20 token)` (public)



set stake token address


### `setFundsManager(address newFundsManager)` (public)



set funds manager address

### `setOracle(contract ITruPriceOracle newOracle)` (public)



set oracle token address


### `changeJoiningPauseStatus(bool status)` (external)



Allow pausing of deposits in case of emergency


### `stakeTokenBalance() → uint256` (public)



Get total balance of stake tokens


### `yTokenBalance() → uint256` (public)



Get total balance of curve.fi pool tokens


### `yTokenValue() → uint256` (public)



Virtual value of yCRV tokens in the pool
Will return sync value if inSync


### `truValue() → uint256` (public)



Price of TRU in USD


### `liquidValue() → uint256` (public)



Virtual value of liquid assets in the pool


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


### `resetApprovals()` (external)



sets all token allowances used to 0

### `join(uint256 amount)` (external)



Join the pool by depositing currency tokens


### `exit(uint256 amount)` (external)



Exit pool
This function will withdraw a basket of currencies backing the pool value


### `liquidExit(uint256 amount)` (external)



Exit pool only with liquid tokens
This function will withdraw TUSD but with a small penalty
Uses the sync() modifier to reduce gas costs of using curve


### `liquidExitPenalty(uint256 amount) → uint256` (public)



Penalty (in % * 100) applied if liquid exit is performed with this amount
returns 10000 if no penalty

### `integrateAtPoint(uint256 x) → uint256` (public)



Calculates integral of 5/(x+50)dx times 10000

### `averageExitPenalty(uint256 from, uint256 to) → uint256` (public)



Calculates average penalty on interval [from; to]


### `flush(uint256 currencyAmount, uint256 minMintAmount)` (external)



Deposit idle funds into curve.fi pool and stake in gauge
Called by owner to help manage funds in pool and save on gas for deposits


### `pull(uint256 yAmount, uint256 minCurrencyAmount)` (external)



Remove liquidity from curve


### `borrow(uint256 amount, uint256 fee)` (external)



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


### `sellStakeToken(uint256 amountIn, uint256 amountOutMin, address[] path)` (public)



Sell collected TRU on Uniswap
- Selling TRU is managed by the contract owner
- Calculations can be made off-chain and called based on market conditions
- Need to pass path of exact pairs to go through while executing exchange
For example, CRV -> WETH -> TUSD


### `collectFees(address beneficiary)` (external)



Claim fees from the pool


### `calcTokenAmount(uint256 currencyAmount) → uint256` (public)

Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
Can be used to control slippage
Called in flush() function




### `calcWithdrawOneCoin(uint256 yAmount) → uint256` (public)



Converts the value of a single yCRV into an underlying asset


### `currencyBalance() → uint256` (internal)



Currency token balance


### `mint(uint256 depositedAmount) → uint256` (internal)





### `updateNameAndSymbol()` (public)



Update name and symbol of this contract


### `StakeTokenChanged(contract IERC20 token)`



Emitted when stake token address


### `OracleChanged(contract ITruPriceOracle newOracle)`



Emitted oracle was changed


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


### `JoiningPauseStatusChanged(bool isJoiningPaused)`



Emitted when joining is paused or unpaused


