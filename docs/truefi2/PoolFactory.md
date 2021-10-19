## `PoolFactory`



Factory used to create pools for a chosen asset
This contract creates a new pool and transfer its ownership to the governance contract
Anyone can create a new pool, however the token has to be whitelisted
Initially created pools hold the same implementation, which can be changed later on individually

### `onlyNotExistingPools(address token)`



Throws if token already has an existing corresponding pool


### `onlyAllowedTokens(address token)`



Throws if token is not whitelisted for creating new pool


### `onlyWhitelistedBorrowers(address borrower)`



Throws if borrower is not whitelisted for creating new pool



### `initialize(contract ImplementationReference _poolImplementationReference, contract ISAFU _safu)` (external)



Initialize this contract with provided parameters


### `addLegacyPool(contract ITrueFiPool2 legacyPool)` (external)



After TUSD pool is updated to comply with ITrueFiPool2 interface, call this with it's address

### `deprecatePool(contract ITrueFiPool2 legacyPool)` (external)



Deprecate a pool from token lookups without removing it from the factory.
Calling this function allows owner to create a replacement pool for the same token.

### `removePool(contract ITrueFiPool2 legacyPool)` (external)



Remove a pool from the factory regardless of deprecation status.

### `createPool(address token)` (external)



Create a new pool behind proxy. Update new pool's implementation.
Transfer ownership of created pool to Factory owner.


### `createSingleBorrowerPool(address token, string borrowerName, string borrowerSymbol)` (external)



Create a new single borrower pool behind proxy. Update new pool's implementation.
Transfer ownership of created pool to Factory owner.


### `allowToken(address token, bool status)` (external)



Change token allowed status


### `whitelistBorrower(address borrower, bool status)` (external)



Change borrower allowance status


### `setAllowAll(bool status)` (external)



Change allowAll status


### `setSafuAddress(contract ISAFU _safu)` (external)






### `PoolCreated(address token, address pool)`



Event to show creation of the new pool


### `SingleBorrowerPoolCreated(address borrower, address token, address pool)`



Event to show creation of the new single borrower pool


### `AllowedStatusChanged(address token, bool status)`



Event to show that token is now allowed/disallowed to have a pool created


### `BorrowerWhitelistStatusChanged(address borrower, bool status)`



Event to show that borrower is now allowed/disallowed to have a single borrower pool


### `AllowAllStatusChanged(bool status)`



Event to show that allowAll status has been changed


### `SafuChanged(contract ISAFU newSafu)`



Emitted when SAFU address is changed


