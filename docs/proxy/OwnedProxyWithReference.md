## `OwnedProxyWithReference`



This contract combines an upgradeability proxy with basic authorization control functionalities
Its structure makes it easy for a group of contracts alike, to share an implementation and to change it easily for all of them at once

### `onlyProxyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingProxyOwner()`



Throws if called by any account other than the pending owner.


### `constructor(address _owner, address _implementationReference)` (public)



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

### `changeImplementationReference(address _implementationReference)` (public)



Allows the proxy owner to change the contract holding address of implementation.


### `implementation() → address` (public)



Get the address of current implementation.


### `fallback()` (external)



Fallback functions allowing to perform a delegatecall to the given implementation.
This function will return whatever the implementation call returns

### `receive()` (external)



This fallback function gets called only when this contract is called without any calldata e.g. send(), transfer()
This would also trigger receive() function on called implementation

### `proxyCall()` (internal)



Performs a low level call, to the contract holding all the logic, changing state on this contract at the same time

### `_changeImplementationReference(address _implementationReference)` (internal)



Function to internally change the contract holding address of implementation.



### `ProxyOwnershipTransferred(address previousOwner, address newOwner)`



Event to show ownership has been transferred


### `NewPendingOwner(address currentOwner, address pendingOwner)`



Event to show ownership transfer is pending


### `ImplementationReferenceChanged(address implementationReference)`



Event to show implementation reference has been changed


