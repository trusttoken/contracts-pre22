## `CrvPriceOracle`






### `constructor()` (public)

Network: Mainnet
Aggregator: CRV/ETH
Address: 0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e
Network: Mainnet
Aggregator: ETH/USD
Address: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
Mainnet deployed: https://etherscan.io/address/0x23DE9562bf8020f5B92a2A04C59b39deABbB2315#readContract



### `getLatestPrice() → uint256` (public)



return the lastest price for CRV/USD with 18 decimals places


### `usdToCrv(uint256 amount) → uint256` (external)



converts from USD with 18 decimals to CRV with 18 decimals


### `crvToUsd(uint256 amount) → uint256` (external)



converts from CRV with 18 decimals to USD with 18 decimals


### `safeUint(int256 value) → uint256` (internal)



convert int256 to uint256



