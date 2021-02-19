## `TrueCurrency`



TrueCurrency is an ERC20 with blacklist & redemption addresses
TrueCurrency is a compliant stablecoin with blacklist and redemption
addresses. Only the owner can blacklist accounts. Redemption addresses
are assigned automatically to the first 0x100000 addresses. Sending
tokens to the redemption address will trigger a burn operation. Only
the owner can mint or blacklist accounts.
This contract is owned by the TokenController, which manages token
minting & admin functionality. See TokenController.sol
See also: BurnableTokenWithBounds.sol
~~~~ Features ~~~~
Redemption Addresses
- The first 0x100000 addresses are redemption addresses
- Tokens sent to redemption addresses are burned
- Redemptions are tracked off-chain
- Cannot mint tokens to redemption addresses
Blacklist
- Owner can blacklist accounts in accordance with local regulatory bodies
- Only a court order will merit a blacklist; blacklisting is extremely rare
Burn Bounds & CanBurn
- Owner can set min & max burn amounts
- Only accounts flagged in canBurn are allowed to burn tokens
- canBurn prevents tokens from being sent to the incorrect address
Reclaimer Token
- ERC20 Tokens and Ether sent to this contract can be reclaimed by the owner


### `mint(address account, uint256 amount)` (external)



Creates `amount` tokens and assigns them to `account`, increasing
the total supply.


### `setBlacklisted(address account, bool _isBlacklisted)` (external)



Set blacklisted status for the account.


### `setCanBurn(address account, bool _canBurn)` (external)



Set canBurn status for the account.


### `_transfer(address sender, address recipient, uint256 amount)` (internal)

Transfer to redemption address will burn tokens with a 1 cent precision


Check if neither account is blacklisted before performing transfer
If transfer recipient is a redemption address, burns tokens


### `_approve(address owner, address spender, uint256 amount)` (internal)



Requere neither accounts to be blacklisted before approval


### `_burn(address account, uint256 amount)` (internal)



Check if tokens can be burned at address before burning


### `isRedemptionAddress(address account) → bool` (internal)

For transfer to succeed, canBurn must be true for redemption address


First 0x100000-1 addresses (0x0000000000000000000000000000000000000001 to 0x00000000000000000000000000000000000fffff)
are the redemption addresses.



### `Blacklisted(address account, bool isBlacklisted)`



Emitted when account blacklist status changes

### `Mint(address to, uint256 value)`



Emitted when `value` tokens are minted for `to`


