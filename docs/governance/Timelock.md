## `Timelock`






### `initialize(address admin_, uint256 delay_)` (external)



Initialize sets the addresses of admin and the delay timestamp


### `receive()` (external)





### `setDelay(uint256 delay_)` (public)



Set the timelock delay to a new timestamp


### `acceptAdmin()` (public)



Accept the pendingAdmin as the admin address

### `setPendingAdmin(address pendingAdmin_)` (public)



Set the pendingAdmin address to a new address


### `queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) → bytes32` (public)



Queue one single proposal transaction


### `cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)` (public)



Cancel one single proposal transaction


### `executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) → bytes` (public)



Execute one single proposal transaction


### `getBlockTimestamp() → uint256` (internal)



Get the current block timestamp



### `NewAdmin(address newAdmin)`





### `NewPendingAdmin(address newPendingAdmin)`





### `NewDelay(uint256 newDelay)`





### `CancelTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





### `ExecuteTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





### `QueueTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





