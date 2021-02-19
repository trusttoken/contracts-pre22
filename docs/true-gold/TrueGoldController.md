## `TrueGoldController`



This contract has been copied from {true-currencies} repository and adjusted for TrueGold needs.
https://github.com/trusttoken/true-currencies/blob/eb01ca47111e66c9fa8bf59d78617ad28e232e06/contracts/truecurrencies/admin/TokenController.sol
This contract allows us to split ownership of the TrueGold contract
into two addresses. One, called the "owner" address, has unfettered control of the TrueGold contract -
it can mint new tokens, transfer ownership of the contract, etc. However to make
extra sure that TrueGold is never compromised, this owner key will not be used in
day-to-day operations, allowing it to be stored at a heightened level of security.
Instead, the owner appoints an various "admin" address.
There are 3 different types of admin addresses;  MintKey, MintRatifier, and MintPauser.
MintKey can request and revoke mints one at a time.
MintPausers can pause individual mints or pause all mints.
MintRatifiers can approve and finalize mints with enough approval.
There are three levels of mints: instant mint, ratified mint, and multiSig mint. Each have a different threshold
and deduct from a different pool.
Instant mint has the lowest threshold and finalizes instantly without any ratifiers. Deduct from instant mint pool,
which can be refilled by one ratifier.
Ratify mint has the second lowest threshold and finalizes with one ratifier approval. Deduct from ratify mint pool,
which can be refilled by three ratifiers.
MultiSig mint has the highest threshold and finalizes with three ratifier approvals. Deduct from multiSig mint pool,
which can only be refilled by the owner.

### `onlyFastPauseOrOwner()`





### `onlyMintKeyOrOwner()`





### `onlyMintPauserOrOwner()`





### `onlyMintRatifierOrOwner()`





### `mintNotPaused()`





### `onlyOwner()`



Throws if called by any account other than the owner.

### `onlyPendingOwner()`



Modifier throws if called by any account other than the pendingOwner.


### `initialize()` (external)





### `transferOwnership(address payable newOwner)` (external)



Allows the current owner to set the pendingOwner address.


### `claimOwnership()` (external)



Allows the pendingOwner address to finalize the transfer.

### `transferTokenProxyOwnership(address _newOwner)` (external)





### `claimTokenProxyOwnership()` (external)





### `upgradeTokenProxyImplTo(address _implementation)` (external)





### `setMintThresholds(uint256 _instant, uint256 _ratified, uint256 _multiSig)` (external)



set the threshold for a mint to be considered an instant mint, ratify mint and multiSig mint
Instant mint requires no approval, ratify mint requires 1 approval and multiSig mint requires 3 approvals

### `setMintLimits(uint256 _instant, uint256 _ratified, uint256 _multiSig)` (external)



set the limit of each mint pool. For example can only instant mint up to the instant mint pool limit
before needing to refill

### `refillInstantMintPool()` (external)



Ratifier can refill instant mint pool

### `refillRatifiedMintPool()` (external)



Owner or 3 ratifiers can refill Ratified Mint Pool

### `refillMultiSigMintPool()` (external)



Owner can refill MultiSig Mint Pool

### `requestMint(address _to, uint256 _value)` (external)



mintKey initiates a request to mint _value for account _to


### `instantMint(address _to, uint256 _value)` (external)



Instant mint without ratification if the amount is less than instantMintThreshold and instantMintPool


### `ratifyMint(uint256 _index, address _to, uint256 _value)` (external)



ratifier ratifies a request mint. If the number of ratifiers that signed off is greater than
the number of approvals required, the request is finalized


### `finalizeMint(uint256 _index)` (public)



finalize a mint request, mint the amount requested to the specified address


### `_subtractFromMintPool(uint256 _value)` (internal)

assumption: only invoked when canFinalize



### `hasEnoughApproval(uint256 _numberOfApproval, uint256 _value) → bool` (public)



compute if the number of approvals is enough for a given mint amount

### `canFinalize(uint256 _index) → bool` (public)



compute if a mint request meets all the requirements to be finalized
utility function for a front end

### `revokeMint(uint256 _index)` (external)



revoke a mint request, Delete the mintOperation


### `mintOperationCount() → uint256` (public)





### `transferMintKey(address _newMintKey)` (external)



Replace the current mintkey with new mintkey


### `invalidateAllPendingMints()` (external)



invalidates all mint request initiated before the current block

### `pauseMints()` (external)



pause any further mint request and mint finalizations

### `unpauseMints()` (external)



unpause any further mint request and mint finalizations

### `pauseMint(uint256 _opIndex)` (external)



pause a specific mint request


### `unpauseMint(uint256 _opIndex)` (external)



unpause a specific mint request


### `setToken(contract TrueGold _newContract)` (external)



Update this contract's token pointer to newContract (e.g. if the
contract is upgraded)

### `setRegistry(contract Registry _registry)` (external)



Update this contract's registry pointer to _registry

### `transferChild(contract IOwnable _child, address _newOwner)` (external)



Transfer ownership of _child to _newOwner.
Can be used e.g. to upgrade this TrueGoldController contract.


### `requestReclaimContract(contract IOwnable _other)` (public)



Transfer ownership of a contract from token to this TrueGoldController.


### `requestReclaimEther()` (external)



send all ether in token address to the owner of TrueGoldController

### `requestReclaimToken(contract IERC20 _token)` (external)



transfer all tokens of a particular type in token address to the
owner of TrueGoldController


### `setFastPause(address _newFastPause)` (external)



set new contract to which specified address can send eth to to quickly pause token


### `pauseToken()` (external)



pause all pausable actions on TrueGold, mints/burn/transfer/approve

### `setBurnBounds(uint256 _min, uint256 _max)` (external)



Change the minimum and maximum amounts that TrueGold users can
burn to newMin and newMax


### `reclaimEther(address payable _to)` (external)



Owner can send ether balance in contract address


### `reclaimToken(contract IERC20 _token, address _to)` (external)



Owner can send erc20 token balance in contract address



### `OwnershipTransferred(address previousOwner, address newOwner)`





### `NewOwnerPending(address currentOwner, address pendingOwner)`





### `SetRegistry(address registry)`





### `TransferChild(address child, address newOwner)`





### `ReclaimContract(address other)`





### `SetToken(contract TrueGold newContract)`





### `RequestMint(address to, uint256 value, uint256 opIndex, address mintKey)`





### `FinalizeMint(address to, uint256 value, uint256 opIndex, address mintKey)`





### `InstantMint(address to, uint256 value, address mintKey)`





### `TransferMintKey(address previousMintKey, address newMintKey)`





### `MintRatified(uint256 opIndex, address ratifier)`





### `RevokeMint(uint256 opIndex)`





### `AllMintsPaused(bool status)`





### `MintPaused(uint256 opIndex, bool status)`





### `FastPauseSet(address _newFastPause)`





### `MintThresholdChanged(uint256 instant, uint256 ratified, uint256 multiSig)`





### `MintLimitsChanged(uint256 instant, uint256 ratified, uint256 multiSig)`





### `InstantPoolRefilled()`





### `RatifyPoolRefilled()`





### `MultiSigPoolRefilled()`





