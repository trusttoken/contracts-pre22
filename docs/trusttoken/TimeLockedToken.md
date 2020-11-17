## `TimeLockedToken`

Time Locked ERC20 Token


Contract which gives the ability to time-lock tokens
The registerLockup() function allows an account to transfer
its tokens to another account, locking them according to the
distribution epoch periods
By overriding the balanceOf(), transfer(), and transferFrom()
functions in ERC20, an account can show its full, post-distribution
balance but only transfer or spend up to an allowed amount
Every time an epoch passes, a portion of previously non-spendable tokens
are allowed to be transferred, and after all epochs have passed, the full
account balance is unlocked

### `onlyTimeLockRegistry()`






### `setTimeLockRegistry(address newTimeLockRegistry)` (external)



Set TimeLockRegistry address


### `_transfer(address _from, address _to, uint256 _value)` (internal)



Transfer function which includes unlocked tokens


### `_burn(address _from, uint256 _value)` (internal)



Check if amount we want to burn is unlocked before burning


### `registerLockup(address receiver, uint256 amount)` (external)



Transfer tokens to another account under the lockup schedule
Emits a transfer event showing a transfer to the recipient
Only the registry can call this function


### `lockedBalance(address account) → uint256` (public)



Get locked balance for an account


### `unlockedBalance(address account) → uint256` (public)



Get unlocked balance for an account


### `epochsPassed() → uint256` (public)





### `nextEpoch() → uint256` (public)



Get timestamp of next epoch
Will revert if all epochs have passed


### `latestEpoch() → uint256` (public)



Get timestamp of latest epoch


### `finalEpoch() → uint256` (public)



Get timestamp of final epoch


### `lockStart() → uint256` (public)



Get timestamp of locking period start



