## `UpgradeableClaimable`



Contract module which provides a basic access control mechanism, where
there is an account (an owner) that can be granted exclusive access to
specific functions.
By default, the owner account will be the one that deploys the contract. Since
this contract combines Claimable and UpgradableOwnable contracts, ownership
can be later change via 2 step method {transferOwnership} and {claimOwnership}
This module is used through inheritance. It will make available the modifier
`onlyOwner`, which can be applied to your functions to restrict their use to
the owner.

### `onlyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingOwner()`



Modifier throws if called by any account other than the pendingOwner.


### `initialize(address __owner)` (internal)



Initializes the contract setting a custom initial owner of choice.


### `owner() → address` (public)



Returns the address of the current owner.

### `pendingOwner() → address` (public)



Returns the address of the pending owner.

### `transferOwnership(address newOwner)` (public)



Allows the current owner to set the pendingOwner address.


### `claimOwnership()` (public)



Allows the pendingOwner address to finalize the transfer.


### `OwnershipTransferred(address previousOwner, address newOwner)`





