## `TimeOwnedUpgradeabilityProxy`



This contract combines an upgradeability proxy with
basic authorization control functionalities
This contract allows us to specify a time at which the proxy can no longer
be upgraded


### `constructor()` (public)



the constructor sets the original owner of the contract to the sender account.

### `setExpiration(uint256 newExpirationTime)` (external)



sets new expiration time

### `_setExpiration(uint256 newExpirationTime)` (internal)





### `expiration() → uint256 _expiration` (public)





### `upgradeTo(address implementation)` (public)



Allows the proxy owner to upgrade the current version of the proxy.



