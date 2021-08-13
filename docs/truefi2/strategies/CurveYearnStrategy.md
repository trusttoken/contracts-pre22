## `CurveYearnStrategy`



TrueFi pool strategy that allows depositing stablecoins into Curve Yearn pool (0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51)
Supports DAI, USDC, USDT and TUSD
Curve LP tokens are being deposited into Curve Gauge and CRV rewards can be sold on 1Inch exchange and transferred to the pool

### `onlyPool()`






### `initialize(contract ITrueFiPool2 _pool, contract ICurvePool _curvePool, contract ICurveGauge _curveGauge, contract ICurveMinter _minter, contract I1Inch3 _1inchExchange, contract ICrvPriceOracle _crvOracle, uint256 _maxPriceSlippage, uint8 _tokenIndex)` (external)





### `setOracle(contract ICrvPriceOracle _crvOracle)` (external)



Sets new  crv oracle address


### `setMaxPriceSlippage(uint256 _maxPriceSlippage)` (external)



Sets new maximum allowed price slippage


### `deposit(uint256 amount)` (external)



Transfer `amount` of `token` from pool and add it as
liquidity to the Curve yEarn Pool
Curve LP tokens are deposited into Curve Gauge


### `withdraw(uint256 minAmount)` (external)



pull at least `minAmount` of tokens from strategy
Remove token liquidity from curve and transfer to pool


### `withdrawAll()` (external)



withdraw everything from strategy
Use with caution because Curve slippage is not controlled

### `value() → uint256` (external)

Balance of CRV is not included into value of strategy,
because it cannot be converted to pool tokens automatically


Total pool value in USD


### `yTokenValue() → uint256` (public)



Price of  in USD


### `yTokenBalance() → uint256` (public)



Get total balance of curve.fi pool tokens


### `crvValue() → uint256` (public)



Price of CRV in USD


### `crvBalance() → uint256` (public)



Get total balance of CRV tokens


### `collectCrv()` (external)



Collect CRV tokens minted by staking at gauge

### `sellCrv(bytes data)` (external)



Swap collected CRV on 1inch and transfer gains to the pool
Receiver of the tokens should be the pool
Revert if resulting exchange price is much smaller than the oracle price


### `calcTokenAmount(uint256 currencyAmount) → uint256` (public)



Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.


### `withdrawFromGaugeIfNecessary(uint256 neededAmount)` (internal)



ensure enough curve.fi pool tokens are available
Check if current available amount of TUSD is enough and
withdraw remainder from gauge


### `transferAllToPool()` (internal)



Internal function to transfer entire token balance to pool

### `conservativePriceEstimation(uint256 price) → uint256` (internal)



Calculate price minus max percentage of slippage during exchange
This will lead to the pool value become a bit undervalued
compared to the oracle price but will ensure that the value doesn't drop
when token exchanges are performed.

### `min(uint256 a, uint256 b) → uint256` (internal)



Helper function to calculate minimum of `a` and `b`


### `normalizeDecimals(uint256 _value) → uint256` (internal)



Helper function to convert between token precision



### `OracleChanged(contract ICrvPriceOracle newOracle)`





### `MaxPriceSlippageChanged(uint256 maxPriceSlippage)`





### `Deposited(uint256 depositedAmount, uint256 receivedYAmount)`





### `Withdrawn(uint256 minAmount, uint256 yAmount)`





### `WithdrawnAll(uint256 yAmount)`





