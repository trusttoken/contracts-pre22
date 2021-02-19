## `Registry`





### `onlyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingOwner()`



Modifier throws if called by any account other than the pendingOwner.


### `confirmWrite(bytes32 _attribute, address _admin) → bool` (internal)





### `setAttribute(address _who, bytes32 _attribute, uint256 _value, bytes32 _notes)` (public)





### `subscribe(bytes32 _attribute, contract IRegistryClone _syncer)` (external)





### `unsubscribe(bytes32 _attribute, uint256 _index)` (external)





### `subscriberCount(bytes32 _attribute) → uint256` (public)





### `setAttributeValue(address _who, bytes32 _attribute, uint256 _value)` (public)





### `hasAttribute(address _who, bytes32 _attribute) → bool` (public)





### `getAttribute(address _who, bytes32 _attribute) → uint256, bytes32, address, uint256` (public)





### `getAttributeValue(address _who, bytes32 _attribute) → uint256` (public)





### `getAttributeAdminAddr(address _who, bytes32 _attribute) → address` (public)





### `getAttributeTimestamp(address _who, bytes32 _attribute) → uint256` (public)





### `syncAttribute(bytes32 _attribute, uint256 _startIndex, address[] _addresses)` (external)





### `reclaimEther(address payable _to)` (external)





### `reclaimToken(contract IERC20 token, address _to)` (external)





### `transferOwnership(address newOwner)` (public)



Allows the current owner to set the pendingOwner address.


### `claimOwnership()` (public)



Allows the pendingOwner address to finalize the transfer.


### `OwnershipTransferred(address previousOwner, address newOwner)`





### `SetAttribute(address who, bytes32 attribute, uint256 value, bytes32 notes, address adminAddr)`





### `SetManager(address oldManager, address newManager)`





### `StartSubscription(bytes32 attribute, contract IRegistryClone subscriber)`





### `StopSubscription(bytes32 attribute, contract IRegistryClone subscriber)`





