## `IRegistry`






### `setAttribute(address _who, bytes32 _attribute, uint256 _value, bytes32 _notes)` (external)





### `subscribe(bytes32 _attribute, contract IRegistryClone _syncer)` (external)





### `unsubscribe(bytes32 _attribute, uint256 _index)` (external)





### `subscriberCount(bytes32 _attribute) → uint256` (external)





### `setAttributeValue(address _who, bytes32 _attribute, uint256 _value)` (external)





### `hasAttribute(address _who, bytes32 _attribute) → bool` (external)





### `getAttribute(address _who, bytes32 _attribute) → uint256, bytes32, address, uint256` (external)





### `getAttributeValue(address _who, bytes32 _attribute) → uint256` (external)





### `getAttributeAdminAddr(address _who, bytes32 _attribute) → address` (external)





### `getAttributeTimestamp(address _who, bytes32 _attribute) → uint256` (external)





### `syncAttribute(bytes32 _attribute, uint256 _startIndex, address[] _addresses)` (external)






