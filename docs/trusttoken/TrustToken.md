## `TrustToken`



The TrustToken contract is a claimable contract where the
owner can only mint or transfer ownership. TrustTokens use 8 decimals
in order to prevent rewards from getting stuck in the remainder on division.
Tolerates dilution to slash stake and accept rewards.


### `initialize()` (public)



initialize trusttoken and give ownership to sender
This is necessary to set ownership for proxy

### `mint(address _to, uint256 _amount)` (external)



mint TRU
Can never mint more than MAX_SUPPLY = 1.45 billion

### `burn(uint256 amount)` (external)





### `decimals() → uint8` (public)





### `rounding() → uint8` (public)





### `name() → string` (public)





### `symbol() → string` (public)






