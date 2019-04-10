![alt tag](https://raw.github.com/trusttoken/trueUSD/master/TrueUSDLogo.png)
![alt tag](https://raw.github.com/trusttoken/trueUSD/master/TrueGBPLogo.png)

# Tokenized Currencies
This repository contains the smart contracts for TrueUSD and TrueGBP, as well as the contracts that support them.
This section contains a high-level overview of the contracts.
For specifics, see the relevant .sol files.

### Proxy/...
We use `DELEGATECALL` proxies so that we can upgrade our contracts without changing their addresses.
We always seek a security audit before upgrading, in order to mitigate risk.

### ProxyStorage.sol
All of the tokens use the storage laid out in ProxyStorage.sol.
Solidity storage variables for tokens should not be declared in any other file.
This mitigates the risk of the storage layout shifting between upgrades.

### modularERC20/...

These contracts are inspired by and roughly equivalent to the corresponding ERC20
token contracts from [OpenZeppelin](https://openzeppelin.org/).
Work is separated into internal functions that can be overridden for storage migrations.

### Admin/...
#### TokenController.sol

TokenController is the owner for each of our tokens.
Power is separated between the Owner key, Mint Pause Keys, the Mint Key, and Mint Ratifier Keys, which protect the mint process.
Risk is configurable in the mint limits.

#### MultiSigOwner.sol

This contract can be the owner of a TokenController.
It turns every TokenController owner function into a multisig function that requires 2/3 approvals.

### HasOwner.sol
Our own implementation of Claimable Contract, formerly part of [OpenZeppelin](https://openzeppelin.org/).

### BurnableTokenWithBounds.sol

This limits the minimum and maximum number of tokens that can be redeemed per-transaction.

### CompliantDepositTokenWithHook.sol
This file processes attributes synced from the [Registry](https://github.com/trusttoken/registry).

#### Deposit addresses
You can register your deposit address using the [Deposit Address Registrar](https://etherscan.io/address/0x00000000000Da14C27C155Bb7C1Ac9Bd7519eB3b).
This will allow you to receive TrueUSD from several addresses.
Such transactions will emit two `Transfer` events.
Exchanges should register deposit addresses to reduce their operating overhead.

#### Redemption addresses
You can redeem these tokens for fiat by transfering them to your redemption address, which starts with at least thirty-five zeroes.
Sign up for your redemption address by creating a [TrustToken](https://app.trusttoken.com/) account.

#### Blacklisted addresses
TrustToken prevents you from sending our tokens to blacklisted addresses.
We blacklist our own contracts so that you cannot send them tokens by mistake.
TrustToken also reserves the right to blacklist accounts that violate the [TrueCoin Terms of Use](https://www.trusttoken.com/terms-of-use/).

#### Registered contracts
By contacting us, you can register a contract to receive a callback when it receives tokens.

### GasRefundToken.sol
We reduce the amount of gas you pay by refunding gas during your transfer.

### TrueUSD.sol, TrueGBP.sol, etc.
These are the top-level ERC20 contracts.
They inherit the aforementioned functionality.

# Contributing
Before creating a pull request, please run the tests, the profiler, and the flattener.

## Setup
Initialize the registry submodule in the root directory.
```bash
git submodule init && git submodule update
```

## Testing
```bash
npm install
npm test # runs ./test.sh
```

## Profiling
To run the profiler and update `GasProfile.json`, run the profile script in the root directory.

```bash
npm run profile # runs ./profile.sh
```

## Flattening
Run the flattener in the root directory.
```bash
npm run flatten # runs ./flatten-all
```

# Links

| Description  | URL |
| ------------- | ------------- |
| Purchase and Redeem | https://app.trusttoken.com/ |
| TUSD Etherscan Page | https://etherscan.io/token/0x0000000000085d4780B73119b644AE5ecd22b376  |
| TGBP Etherscan Page | https://etherscan.io/token/0x00000000441378008EA67F4284A57932B1c000a5  |
| TUSD on CoinMarketCap  | https://coinmarketcap.com/currencies/trueusd/  |
| Terms of Use  | https://www.trusttoken.com/terms-of-use/  |

## Social

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
| Huobi     | https://www.huobi.com/    |
| Okex      | https://www.okex.com/     |
| Bittrex   | https://bittrex.com       |
| CoinTiger | https://www.cointiger.pro |
| Upbit     | https://upbit.com/        |
| HBUS      | https://www.hbus.com/     |
