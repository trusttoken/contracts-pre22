## `TruPriceOracle`






### `constructor()` (public)

Network: Mainnet
Aggregator: TRU/USD
Address: 0x26929b85fE284EeAB939831002e1928183a10fb1
Mainnet: https://etherscan.io/address/0x51EDd4c89B8A64B77bd9c029f55DA31c2038F5FA#readContract
Ropsten: https://ropsten.etherscan.io/address/0x7e4c25511079595891c76D734Ae542CAD0AA4F32#readContract



### `getLatestPrice() → int256` (public)



return the lastest price for TRU/USD with 8 decimals places


### `usdToTru(uint256 amount) → uint256` (external)



converts from USD with 18 decimals to TRU with 8 decimals
Divide by 100 since Chainlink returns 10 decimals and TRU is 8 decimals


### `truToUsd(uint256 amount) → uint256` (external)



converts from TRU with 8 decimals to USD with 18 decimals
Multiply by 100 since Chainlink returns 10 decimals and TRU is 8 decimals


### `safeUint(int256 value) → uint256` (internal)



convert int256 to uint256



