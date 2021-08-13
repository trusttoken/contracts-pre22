## `Timelock`






### `initialize(address admin_, uint256 delay_)` (external)



Initialize sets the addresses of admin and the delay timestamp


### `receive()` (external)





### `setPauser(address _pauser)` (external)



Set new pauser address


### `emergencyPauseProxy(contract IOwnedUpgradeabilityProxy proxy)` (external)



Emergency pause a proxy owned by this contract
Upgrades a proxy to the zero address in order to emergency pause


### `emergencyPauseReference(contract ImplementationReference implementationReference)` (external)



Emergency pause a proxy with reference owned by this contract
Upgrades implementation in ImplementationReference to 0 address


### `setPauseStatus(contract IPauseableContract pauseContract, bool status)` (external)



Pause or unpause Pausable contracts.
Useful to allow/disallow deposits or certain actions in compromised contracts


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





### `NewPauser(address newPauser)`





### `NewPendingAdmin(address newPendingAdmin)`





### `NewDelay(uint256 newDelay)`





### `EmergencyPauseProxy(contract IOwnedUpgradeabilityProxy proxy)`





### `EmergencyPauseReference(contract ImplementationReference implementationReference)`





### `PauseStatusChanged(address pauseContract, bool status)`





### `CancelTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





### `ExecuteTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





### `QueueTransaction(bytes32 txHash, address target, uint256 value, string signature, bytes data, uint256 eta)`





