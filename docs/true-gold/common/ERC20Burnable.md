## `ERC20Burnable`



Extension of {ERC20} that allows token holders to destroy both their own
tokens and those that they have an allowance for, in a way that can be
recognized off-chain (via event analysis).


### `burn(uint256 amount)` (public)



Destroys `amount` tokens from the caller.
See {ERC20-_burn}.

### `burnFrom(address account, uint256 amount)` (public)



Destroys `amount` tokens from `account`, deducting from the caller's
allowance.
See {ERC20-_burn} and {ERC20-allowance}.
Requirements:
- the caller must have allowance for ``accounts``'s tokens of at least
`amount`.


