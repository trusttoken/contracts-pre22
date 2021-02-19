## `AvalancheTokenController`



This contract allows us to split ownership of the TrueCurrency contract
into two addresses. One, called the "owner" address, has unfettered control of the TrueCurrency contract -
it can mint new tokens, transfer ownership of the contract, etc. However to make
extra sure that TrueCurrency is never compromised, this owner key will not be used in
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

### `onlyMintKeyOrOwner()`





### `onlyMintPauserOrOwner()`





### `onlyMintRatifierOrOwner()`





### `onlyRegistryAdmin()`





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

### `transferTrueCurrencyProxyOwnership(address _newOwner)` (external)





### `claimTrueCurrencyProxyOwnership()` (external)





### `upgradeTrueCurrencyProxyImplTo(address _implementation)` (external)





### `setMintThresholds(uint256 _instant, uint256 _ratified, uint256 _multiSig)` (external)



set the threshold for a mint to be considered an instant mint,
ratify mint and multiSig mint. Instant mint requires no approval,
ratify mint requires 1 approval and multiSig mint requires 3 approvals

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



Instant mint without ratification if the amount is less
than instantMintThreshold and instantMintPool


### `ratifyMint(uint256 _index, address _to, uint256 _value)` (external)



ratifier ratifies a request mint. If the number of
ratifiers that signed off is greater than the number of
approvals required, the request is finalized


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



get mint operatino count


### `transferMintKey(address _newMintKey)` (external)



Replace the current mintkey with new mintkey


### `setRegistryAdmin(address admin)` (external)





### `setIsMintPauser(address account, bool status)` (external)





### `setIsMintRatifier(address account, bool status)` (external)





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


### `setToken(contract ITrueCurrency _newContract)` (external)



Update this contract's token pointer to newContract (e.g. if the
contract is upgraded)

### `issueClaimOwnership(address _other)` (public)



Claim ownership of an arbitrary HasOwner contract

### `transferChild(contract IHasOwner _child, address _newOwner)` (external)



Transfer ownership of _child to _newOwner.
Can be used e.g. to upgrade this TokenController contract.


### `requestReclaimEther()` (external)



send all ether in token address to the owner of tokenController

### `requestReclaimToken(contract IERC20 _token)` (external)



transfer all tokens of a particular type in token address to the
owner of tokenController


### `pauseToken()` (external)



pause all pausable actions on TrueCurrency, mints/burn/transfer/approve

### `setBurnBounds(uint256 _min, uint256 _max)` (external)



Change the minimum and maximum amounts that TrueCurrency users can
burn to newMin and newMax


### `reclaimEther(address payable _to)` (external)



Owner can send ether balance in contract address


### `reclaimToken(contract IERC20 _token, address _to)` (external)



Owner can send erc20 token balance in contract address


### `setCanBurn(address burner, bool canBurn)` (external)



Owner can allow address to burn tokens


### `setBlacklisted(address account, bool isBlacklisted)` (external)



Set blacklisted status for the account.



### `OwnershipTransferred(address previousOwner, address newOwner)`



Emitted when ownership of controller was transferred

### `NewOwnerPending(address currentOwner, address pendingOwner)`



Emitted when ownership of controller transfer procedure was started

### `TransferChild(address child, address newOwner)`



Emitted when owner was transferred for child contract

### `RequestReclaimContract(address other)`



Emitted when child ownership was claimed

### `SetToken(contract ITrueCurrency newContract)`



Emitted when child token was changed

### `CanBurn(address burner, bool canBurn)`



Emitted when canBurn status of the `burner` was changed to `canBurn`

### `RequestMint(address to, uint256 value, uint256 opIndex, address mintKey)`



Emitted when mint was requested

### `FinalizeMint(address to, uint256 value, uint256 opIndex, address mintKey)`



Emitted when mint was finalized

### `InstantMint(address to, uint256 value, address mintKey)`



Emitted on instant mint

### `TransferMintKey(address previousMintKey, address newMintKey)`



Emitted when mint key was replaced

### `MintRatified(uint256 opIndex, address ratifier)`



Emitted when mint was ratified

### `RevokeMint(uint256 opIndex)`



Emitted when mint is revoked

### `AllMintsPaused(bool status)`



Emitted when all mining is paused (status=true) or unpaused (status=false)

### `MintPaused(uint256 opIndex, bool status)`



Emitted when opIndex mint is paused (status=true) or unpaused (status=false)

### `MintApproved(address approver, uint256 opIndex)`



Emitted when mint is approved

### `FastPauseSet(address _newFastPause)`



Emitted when fast pause contract is changed

### `MintThresholdChanged(uint256 instant, uint256 ratified, uint256 multiSig)`



Emitted when mint threshold changes

### `MintLimitsChanged(uint256 instant, uint256 ratified, uint256 multiSig)`



Emitted when mint limits change

### `InstantPoolRefilled()`



Emitted when instant mint pool is refilled

### `RatifyPoolRefilled()`



Emitted when instant mint pool is ratified

### `MultiSigPoolRefilled()`



Emitted when multisig mint pool is ratified

