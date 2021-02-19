## `TimeLockRegistry`

Register Lockups for TimeLocked ERC20 Token


This contract allows owner to register distributions for a TimeLockedToken
To register a distribution, register method should be called by the owner.
claim() should then be called by account registered to recieve tokens under lockup period
If case of a mistake, owner can cancel registration
Note this contract must be setup in TimeLockedToken's setTimeLockRegistry() function


### `initialize(contract TimeLockedToken _token)` (external)



Initalize function so this contract can be behind a proxy


### `register(address receiver, uint256 distribution)` (external)



Register new SAFT account


### `cancel(address receiver)` (external)



Cancel distribution registration


### `claim()` (external)



Claim tokens due amount


### `Register(address receiver, uint256 distribution)`





### `Cancel(address receiver, uint256 distribution)`





### `Claim(address account, uint256 distribution)`





