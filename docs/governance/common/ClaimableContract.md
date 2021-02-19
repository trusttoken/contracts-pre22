## `ClaimableContract`



The ClaimableContract contract is a copy of Claimable Contract by Zeppelin.
and provides basic authorization control functions. Inherits storage layout of
ProxyStorage.

### `onlyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingOwner()`



Modifier throws if called by any account other than the pendingOwner.


### `owner() → address` (public)





### `pendingOwner() → address` (public)





### `constructor()` (public)



sets the original `owner` of the contract to the sender
at construction. Must then be reinitialized

### `transferOwnership(address newOwner)` (public)



Allows the current owner to set the pendingOwner address.


### `claimOwnership()` (public)



Allows the pendingOwner address to finalize the transfer.


### `OwnershipTransferred(address previousOwner, address newOwner)`





