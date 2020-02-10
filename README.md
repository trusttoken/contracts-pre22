# Deployments
For all of our deployments, the address is the same between mainnet and testnet.
Our source code is verified on Etherscan.

## Tokens
| Contract | Token Address | Controller Address | Mainnet | Rinkeby | Kovan |
| ---------|:-------------:|:------------------:|:-------:|:-------:|:-----:|
| TrueUSD | `0x0000000000085d4780B73119b644AE5ecd22b376` | `0x0000000000075EfBeE23fe2de1bd0b7690883cc9` | ✅ | ✅ | ✅ |
| TrueGBP | `0x00000000441378008EA67F4284A57932B1c000a5` | `0x00000000BbcF7700A1b403C9EB666f350707b900` | ✅ | ✅ | 🚫 |
| TrueAUD | `0x00006100f7090010005f1bd7ae6122c3c2cf0090` | `0x0000109a8344DE9c00465264006C0000769A2770` | ✅ | ✅ | 🚫 |
| TrueCAD | `0x00000100F2A2bd000715001920eB70D229700085` | `0x00005cAD001e0900002979f7314D00Fc480a29bD` | ✅ | ✅ | ✅ |
| TrueHKD | `0x0000852600CEB001E08e00bC008be620d60031F2` | `0x0000107d120000E00095Cf06b787a0a900B1F8Bd` | ✅ | ✅ | 🚫 |

### Getting Testnet Tokens
For the testnet tokens, the controller is a [TokenFaucet](contracts/utilities/TokenFaucet.sol), so anybody can mint as many test tokens as they want.
Send `faucet(uint256)` (`0x5c3976a8`) to the appropriate controller to obtain funds.
[Here](https://rinkeby.etherscan.io/tx/0x692ba78f1486f2e7203a7e45a5b7de66c2ff9b0a20a4ee03d640275611ba3e7a) is an example.
Note that the tokens have 18 decimal places of precision.
You can mint up to 1,000,000,000,000 tokens per transaction.

## Utilities
| Contract | Address | Mainnet | Rinkeby | Kovan |
| ---------|:-------:|:-------:|:-------:|:-----:|
| Registry            | `0x0000000000013949F288172bD7E36837bDdC7211` | ✅ | ✅ | ✅ |
| Autosweep Registrar | `0x00000000000Da14C27C155Bb7C1Ac9Bd7519eB3b` | ✅ | ✅ | ✅ |

### Registering for Autosweep
Sending any transaction to the [Autosweep Registrar](contracts/utilities/DepositAddressRegistrar.sol) registers your deposit address for all of our tokens.
See the section on [Autosweep](#Autosweep).

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

#### Autosweep
Registering a wallet creates a million deposit addresses that automatically forward their True Currency balances.
The created deposit addresses share the first 35 characters of their address with the registering wallet.
You can register your deposit address using the [Autosweep Registrar](https://etherscan.io/address/0x00000000000Da14C27C155Bb7C1Ac9Bd7519eB3b).

Transfers to any of your deposit addresses will forward to your wallet in the same transaction.
Such transactions will emit two `Transfer` events.
The first event documents the expected value transfer from the sender to the deposit address.
The second event documents the automatic sweep from the deposit address to the wallet.

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
| Terms of Use  | https://www.trusttoken.com/terms-of-use/  |
| Etherscan: TUSD | https://etherscan.io/token/0x0000000000085d4780B73119b644AE5ecd22b376 |
| Etherscan: TGBP | https://etherscan.io/token/0x00000000441378008EA67F4284A57932B1c000a5 |
| Etherscan: TAUD | https://etherscan.io/token/0x00006100F7090010005F1bd7aE6122c3C2CF0090 |
| Etherscan: TCAD | https://etherscan.io/token/0x00000100F2A2bd000715001920eB70D229700085 |
| CoinMarketCap: TUSD  | https://coinmarketcap.com/currencies/trueusd/  |

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
