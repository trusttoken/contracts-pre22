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
The ERCevents contract is used to ensure that events are still emitted from the original address even
after the TrueUSD contract is delegated.

### RedeemToken.sol

This makes it easier for users to burn tokens (i.e. redeem them for USD) by treating sends to 0x0 as
burn operations.

### BurnableTokenWithBounds.sol

This limits the minimum and maximum number of tokens that can be burned (redeemed) at once.

### ...Delegate....sol

If a new version of the TrueUSD contract is ever launched, these three contracts allow users
to continue using the old version if they want and it will forward all basic transactions to the new one.
See the section entitled Delegation Process below.

### CompliantToken.sol

This ensures that only users who have passed a KYC/AML check can receive newly minted tokens or
trade on certain restricted exchanges. It also allows for blacklisting of bad actors in accordance
with the [TrueCoin Terms of Use](https://www.trusttoken.com/trueusd/terms-of-use).

### TokenWithFees.sol

This allows for transaction fees.

### TrueUSD.sol

This is the top-level ERC20 contract tying together all the previously mentioned functionality.

### TimeLockedController.sol

This contract is the initial owner of TrueUSD.sol. Consists of an Owner key, Mint Pause Keys,
Mint Key, and Mint Approval Keys. It also imposes time delays on mint requests to maximize security.

### MultiSigOwner.sol

This contract is the owner of TimeLockedController.sol. It turns every function that only the owner can access into a multisig function that requires 2/3 approvals.

### Delegation Process

To delegate calls to new contract, first deploy a contract that implements DelegateBurnable. Configure fees, burn bounds, global pause etc.
The contract must also implement setBalanceSheet(address) and setAllowanceSheet(address) in order to claim the storage contracts.

Set registry instance for the new contract. Set totalSupply to equal to the current totalSupply of the old contract.

Transfer ownership of the new contract to TimeLockedController. Claim ownership of new contract with TimeLockedController.

If the new contract has function setDelegatedFrom, call the function with TrueUSD contract address as the parameter.

call delegateToNewContract(\_newContractAddress, \_balanceSheetAddress, \_allowanceSheetAddress) to delegate to new contract.

## Testing

Ensure the registry submodule is in the root directory

-`rm -r registry` -`git clone git@github.com:trusttoken/registry.git`

To run the tests and generate a code coverage report:

- `npm install`
- `./node_modules/.bin/solidity-coverage`

## Other Information

| Description  | URL |
| ------------- | ------------- |
| Etherscan Page | https://etherscan.io/token/0x8dd5fbce2f6a956c3022ba3663759011dd51e73e  |
| Coinmarketcap  | https://coinmarketcap.com/currencies/true-usd/  |
| TrueUSD’s Terms of Use  | https://www.trusttoken.com/terms-of-use/  |

## Social Links

| Pages    | URL                                          |
| -------- | -------------------------------------------- |
| Website  | https://www.trueusd.com/                     |
| Facebook | https://www.facebook.com/TrustToken/         |
| Twitter  | https://twitter.com/TrustToken               |
| Telegram | https://t.me/joinchat/HihkMkTja1gIyBRM1J1_vg |

## Exchanges where TrueUSD is Traded

| Exchanges | URL                       |
| --------- | ------------------------- |
| Binance   | https://www.binance.com/  |
| Bittrex   | https://bittrex.com       |
| CoinTiger | https://www.cointiger.pro |
| Upbit     | https://upbit.com/        |
| HBUS      | https://www.hbus.com/     |
