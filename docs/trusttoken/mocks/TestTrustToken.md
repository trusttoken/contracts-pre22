## `TestTrustToken`



Adds faucet feature to the TRU, aimed to be used on testnets


### `faucet(address to, uint256 amount)` (public)



faucet for testnet TRU
Can never mint more than MAX_SUPPLY = 1.45 billion
Set duration above 0 for block delays


### `ownerFaucet(address to, uint256 amount)` (public)



faucet for testnet TRU owner
Can never mint more than MAX_SUPPLY = 1.45 billion
Set duration above 0 for block delays


### `getStamp() → uint256 stamp` (public)



get last timestamp TRU was minted


### `setStamp(uint256 stamp)` (internal)



store last timestamp TRU was minted


