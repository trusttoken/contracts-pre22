## `TruPriceChainLinkOracle`






### `constructor(contract IChainLink _chainlinkOracle)` (public)





### `usdToTru(uint256 amount) → uint256` (external)



converts from USD with 18 decimals to TRU with 8 decimals
Divide by 100 since Chainlink returns 10 decimals and TRU is 8 decimals


### `truToUsd(uint256 amount) → uint256` (external)



converts from TRU with 8 decimals to USD with 18 decimals
Multiply by 100 since Chainlink returns 10 decimals and TRU is 8 decimals


### `safeUint(int256 value) → uint256` (internal)



convert int256 to uint256



