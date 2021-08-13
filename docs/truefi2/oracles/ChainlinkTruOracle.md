## `ChainlinkTruOracle`






### `constructor()` (public)

Network: Mainnet
Aggregator: TRU/USD
Address: 0x26929b85fE284EeAB939831002e1928183a10fb1



### `token() → contract IERC20WithDecimals` (public)





### `tokenToUsd(uint256 tokenAmount) → uint256` (public)





### `getLatestTruPrice() → uint256` (public)



return the latest price for TRU/USD with 8 decimals places


### `tokenToTru(uint256 tokenAmount) → uint256` (external)



converts from USD with 6 decimals to TRU with 8 decimals
Divide by 100 since tokenToUsd returns 18 decimals, getLatestTruPrice returns 8 and TRU is 8 decimals
10^18 / 10^8 / 10^8 = 10^2


### `truToToken(uint256 truAmount) → uint256` (external)



converts from TRU with 8 decimals to corresponding amount of tokens


### `safeUint(int256 value) → uint256` (internal)



convert int256 to uint256



