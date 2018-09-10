![alt tag](https://raw.github.com/trusttoken/trueUSD/readMe/Logo.png)


# TrueUSD

This repository contains the TrueUSD ERC20 contract and related contracts.

## The Contracts

This is a high-level overview of the contracts. For more specifics, see the relevant .sol files.

### modularERC20/...

These contracts are inspired by and roughly equivalent to the corresponding ERC20
token contracts from [OpenZeppelin](https://openzeppelin.org/). The main difference is
that they keep track of balances and allowances by using separate contracts (BalanceSheet.sol
and AllowanceSheet.sol) instead of mappings in their own storage.

### WithdrawalToken.sol

This makes it easier for users to burn tokens (i.e. redeem them for USD) by treating sends to 0x0 as
burn operations.

### BurnableTokenWithBounds.sol

This limits the minimum and maximum amount of tokens that can be burned (redeemed) at once.

### ...Delegate....sol

If a new version of the TrueUSD contract is ever launched, these three contracts allow users
to continue using the old version if they want and it will forward all basic transactions to the new one.
see Delegation process.

### CompliantToken.sol

This ensures that only users who have passed a KYC/AML check can receive newly minted tokens or
trade on certain restricted exchanges. It also allows for blacklisting of bad actors in accordance
with the [TrueCoin Terms of Use](https://www.trusttoken.com/trueusd/terms-of-use).

### TokenWithFees.sol

This allows for transaction fees.

### TrueUSD.sol

This is the top-level ERC20 contract tying together all the previously mentioned functionality.

### TimeLockedController.sol

This contract is the initial owner of TrueUSD.sol. It splits ownership into 'owner' and 'admin'
for extra security.


### Delegation process

To delegate calls to new contract, first deploy a contract that implements DelegateBurnable. Configure fees, burn bounds etc.
Also must implement setBalanceSheet(address) and SetAllowanceSheet(address) functions that can claim storage contracts.


Transfer ownership of the new contract to TimeLockedController. Claim ownership of new contract with TimeLockedController.

If the new contract has function setDelegatedFrom, call the function with TrueUSD contract address as the parameter.

call delegateToNewContract(_newContractAddress, _balanceSheetAddress, _allowanceSheetAddress) to delegate to new contract.


## Testing

To run the tests and generate a code coverage report:

- `npm install`
- `./node_modules/.bin/solidity-coverage`
