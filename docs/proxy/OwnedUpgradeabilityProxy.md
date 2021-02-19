## `OwnedUpgradeabilityProxy`



This contract combines an upgradeability proxy with basic authorization control functionalities

### `onlyProxyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingProxyOwner()`



Throws if called by any account other than the pending owner.


### `constructor()` (public)



the constructor sets the original owner of the contract to the sender account.

### `proxyOwner() → address owner` (public)



Tells the address of the owner


### `pendingProxyOwner() → address pendingOwner` (public)



Tells the address of the owner


### `_setUpgradeabilityOwner(address newProxyOwner)` (internal)



Sets the address of the owner

### `_setPendingUpgradeabilityOwner(address newPendingProxyOwner)` (internal)



Sets the address of the owner

### `transferProxyOwnership(address newOwner)` (external)



Allows the current owner to transfer control of the contract to a newOwner.
changes the pending owner to newOwner. But doesn't actually transfer


### `claimProxyOwnership()` (external)



Allows the pendingOwner to claim ownership of the proxy

### `upgradeTo(address implementation)` (public)



Allows the proxy owner to upgrade the current version of the proxy.


### `implementation() → address impl` (public)





### `fallback()` (external)



Fallback functions allowing to perform a delegatecall to the given implementation.
This function will return whatever the implementation call returns

### `receive()` (external)





### `proxyCall()` (internal)






### `ProxyOwnershipTransferred(address previousOwner, address newOwner)`



Event to show ownership has been transferred


### `NewPendingOwner(address currentOwner, address pendingOwner)`



Event to show ownership transfer is pending


### `Upgraded(address implementation)`



This event will be emitted every time the implementation gets upgraded


