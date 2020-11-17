## `TrueFiPool`



Lending pool which uses curve.fi to store idle funds
Earn high interest rates on currency deposits through uncollateralized loans
Funds deposited in this pool are NOT LIQUID!
Exiting the pool will withdraw a basket of LoanTokens backing the pool
After exiting, an account will need to wait for LoanTokens to expire and burn them
It is recommended to perform a zap or swap tokens on Uniswap for liquidity
Funds are managed through an external function to save gas on deposits


### `initialize(contract ICurvePool __curvePool, contract ICurveGauge __curveGauge, contract IERC20 __currencyToken, contract ITrueLender __lender, contract IUniswapRouter __uniRouter)` (public)



Initialize pool


### `currencyToken() → contract IERC20` (public)



get currency token address


### `yTokenBalance() → uint256` (public)



Get total balance of curve.fi pool tokens

### `poolValue() → uint256` (public)



Calculate pool value in TUSD
"virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens


### `ensureEnoughTokensAreAvailable(uint256 neededAmount)` (internal)



ensure enough curve.fi pool tokens are available
Check if current available amount of TUSD is enough and
withdraw remainder from gauge


### `setJoiningFee(uint256 fee)` (external)



set pool join fee


### `join(uint256 amount)` (external)



Join the pool by depositing currency tokens


### `exit(uint256 amount)` (external)



Exit pool
This function will withdraw a basket of currencies backing the pool value


### `flush(uint256 currencyAmount, uint256 minMintAmount)` (external)



Deposit idle funds into curve.fi pool and stake in gauge
Called by owner to help manage funds in pool and save on gas for deposits


### `pull(uint256 yAmount, uint256 minCurrencyAmount)` (external)



Remove liquidity from curve


### `borrow(uint256 expectedAmount, uint256 amountWithoutFee)` (external)



Remove liquidity from curve and transfer to borrower


### `repay(uint256 currencyAmount)` (external)



repay debt by transferring tokens to the contract


### `collectCrv(uint256 amountOutMin, address[] path)` (external)



Collect CRV tokens minted by staking at gauge and sell them on Uniswap
- Selling CRV is managed by the contract owner
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


