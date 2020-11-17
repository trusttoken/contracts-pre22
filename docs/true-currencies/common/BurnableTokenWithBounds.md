## `BurnableTokenWithBounds`



Burning functions as redeeming money from the system.
The platform will keep track of who burns coins,
and will send them back the equivalent amount of money (rounded down to the nearest cent).


### `burn(uint256 amount)` (external)



Destroys `amount` tokens from `msg.sender`, reducing the
total supply.


### `setBurnBounds(uint256 _min, uint256 _max)` (external)



Change the minimum and maximum amount that can be burned at once.
Burning may be disabled by setting both to 0 (this will not be done
under normal operation, but we can't add checks to disallow it without
losing a lot of flexibility since burning could also be as good as disabled
by setting the minimum extremely high, and we don't want to lock
in any particular cap for the minimum)


### `_burn(address account, uint256 amount)` (internal)



Checks if amount is within allowed burn bounds and
destroys `amount` tokens from `account`, reducing the
total supply.



### `Burn(address burner, uint256 value)`



Emitted when `value` tokens are burnt from one account (`burner`)


### `SetBurnBounds(uint256 newMin, uint256 newMax)`

`newMin` should never be greater than `newMax`

Emitted when new burn bounds were set


