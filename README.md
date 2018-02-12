# TrueUSD

This repository contains the TrueUSD ERC20 contract and related contracts. For
a high-level overview, see this [video](https://www.youtube.com/watch?v=vv6-rcjjDXM).

## TrueUSD.sol

TrueUSD.sol is the main ERC20 contract. It inherits the following from
[OpenZeppelin](https://openzeppelin.org/)'s open source standard token contracts:
 1. standard ERC20 functionality
 2. burning tokens
 3. pausing all ERC20 functionality in an emergency
 4. transferring ownership of the contract

Additionally, it adds the following features:

### Whitelists

In order to deposit USD and receive newly minted TrueUSD, or to burn TrueUSD to
redeem it for USD, users must first get onto the corresponding whitelists
(AddressList.sol) by going through a KYC process (which includes proving they
control their ethereum address using AddressValidation.sol).

### Blacklist

Addresses can also be blacklisted, preventing them from sending or receiving
TrueUSD. This can be used to prevent the use of TrueUSD by bad actors in
accordance with law enforcement. The blacklist will only be used in accordance
with the [TrueCoin Terms of Use](https://truecoin.com/terms-of-use).

### Insurance Fees

The contract is equipped to charge transaction fees upon minting, burning, and/or
transferring of TrueUSD. At time of writing there is a 7 bips fee on transfers
and no fee for minting or burning. These fees are intended to compensate whomever
is insuring the contract. With the launch of the TrustToken platform, the insurer
will stake TrustToken so that if anything were to go wrong with the USD backing
(e.g. a bank holding the funds goes under), TrueUSD holders could be compensated
from the TrustToken stake instead.

### Delegation to a new contract

If TrueUSD.sol ever needs to be upgraded, the new contract will implement the
interface from DelegateERC20.sol and will be stored in the 'delegate' address
of the TrueUSD contract. This allows all TrueUSD ERC20 calls to be forwarded
to the new contract, to allow for a seamless transition for exchanges and
other services that may choose to keep using the old contract.

## TimeLockedController.sol

This contract allows us to split ownership of the TrueUSD contract into two addresses.
One, called the "owner" address, has unfettered control of the TrueUSD contract -
it can mint new tokens, transfer ownership of the contract, etc. However to make
extra sure that TrueUSD is never compromised, this owner key will not be used in
day-to-day operations, allowing it to be stored at a heightened level of security.
Instead, the owner appoints an "admin" address. The admin can do most things the
owner can do, and will be used in everyday operation. However, for critical
operations like minting new tokens or transferring the contract, the admin can
only perform these operations by calling a pair of functions - e.g. `requestMint`
and `finalizeMint` - with (roughly) 24 hours in between the two calls.
This allows us to watch the blockchain and if we discover the admin has been
compromised and there are unauthorized operations underway, we can use the owner key
to cancel those operations and replace the admin.

## AddressList.sol / AddressValidation.sol

See "Whitelists" and "Blacklist" above.

## DelegateERC20.sol

See "Delegation to a new contract" above.
