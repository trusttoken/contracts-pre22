# 💰 TrueFi Smart Contracts

## 🗂 Table of Contents
- [💡 Intro](#-💡-Intro)
- [📎 Projects](#-📎-Projects)
- [🧰 Installation](#-🧰-Installation)
- [✅ Testing](#-✅-Testing)
- [🚉 Addresses](#-🚉-Addresses)

# 💡 Intro
TrueFi is a decentralized protocol for uncollateralized lending. This repository contains all smart contracts used across TrueFi ecosystem. Contracts are written in Solidity. All key functionalities are tested with attached TypeScript test suite. Apart from contracts and tests repository contains scripts used for deployment and maintenance of existing infrastructure.

# 📎 Projects
Repository consists of following sub-projects.
## TrueFi
Core TrueFi smart contracts. These contracts are responsible for establishing main protocol functionalities like creating loans, rating loans, rewarding raters etc. This repository also contains contracts used for TRU liquidity mining program.
## True Currencies
Contracts used for True Currencies - a set of fully-backed stablecoins. True Currencies feature tokens pegged to USD, AUD, HKD, GBP and CAD.
## Governance
Contracts implementing TrueFi governance. Sub-project features both governor contract and all contracts implementing voting mechanisms.
## Proxy
Contracts and utilities allowing to use unified proxy structure across whole TrueFi ecosystem.
## Trust Token
Contracts implementing TRU - TrueFi ecosystem governance token.
## True Gold
Smart contracts implementing True Gold - a synthetic gold on Ethereum blockchain.


# 🧰 Installation
In order to compile the contracts first clone the repository. In order to do that run
```
git clone git@github.com:trusttoken/smart-contracts.git
```
Then enter `smart-contracts` directory and install all necessary dependencies by running
```
yarn
```
**Important note:** You need to have `node` and `yarn` already installed on your machine.

In order to compile the smart contracts run
```
yarn build
``` 
# ✅ Testing
In order to run test suite, run
```
yarn test
```
Make sure to install all dependencies and compile contracts first.

In order to run linter, run
```
yarn lint
```

In order to run typescript type checks, run
```
yarn typecheck
```

All three check suites can be run at once by running
```
yarn checks
```

# 🚉 Addresses
## Mainnet
| Contract | Proxy Address | Implementation Address |
|:-------:|:-------:|:-----:|
| TrueUSD | `0x0000000000085d4780B73119b644AE5ecd22b376` | `0x7a9701453249e84fd0d5afe5951e9cbe9ed2e90f` |
| TrueGBP | `0x00000000441378008EA67F4284A57932B1c000a5` | `0xAA912F203DcC1f5b6F862c0e0dA3254Cfc08A1d9` |
| TrueAUD | `0x00006100f7090010005f1bd7ae6122c3c2cf0090` | `0xc40750744f075fdC4a0A4c75b7af9380bC59Befb` |
| TrueCAD | `0x00000100F2A2bd000715001920eB70D229700085` | `0x0fe124A7666F63ba8E0A460c64E3bf739bC259d8` |
| TrueHKD | `0x0000852600CEB001E08e00bC008be620d60031F2` | `0x9c1A48a8A9bd4345DCc16d65F96f20417a7DAacE` |
| Registry | `0x0000000000013949f288172bd7e36837bddc7211` | `0x137ceed64037adab752ed4a4afbec1df3d2f0dad` |
| TRU Token | `0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784` | `0x4b4e1f67c7298d242555eb35d8e5016f0c4f6df4` |
| stkTRU Token | `0x23696914Ca9737466D8553a2d619948f548Ee424` | `0xA367647cfc0525CBbdEe6EA036617E0884e3128b` |
| TrueFi Pool | `0xa1e72267084192db7387c8cc1328fade470e4149` | `0xB3C6fd9a58329172D043C987aBfcE211E9985613` |
| TrueLender | `0x16d02Dc67EB237C387023339356b25d1D54b0922` | `0x271b02176A9BD1336019A21eDA4ee79a5D32Db5a` |
| TrueRatingAgencyV2 | `0x05461334340568075bE35438b221A3a0D261Fb6b` | `0x87d1616B9B3a0fD756EF4B4Abff29B30ab813f42` |
| LoanFactory | `0x4ACE6dE67E9a9EDFf5c2d0a584390Fb5394119e7` | `0xC20500Df4A76B671f5166f6A0E4f36A8F5CFC177` |
| TrueFarm tfTUSD | `0x8FD832757F58F71BAC53196270A4a55c8E1a29D9` | `0x5810380CBC47E1F2Ab42Eeaa69A142CC6C419F27` |
| TrueFarm Uni:TUSD/tfTUSD | `0xf8F14Fbb93fa0cEFe35Acf7e004fD4Ef92d8315a` | `0xEA522Bc8c78E0E7657C30CcE5ef897f887505fb8` |
| TrueFarm Uni:ETH/TRU | `0xED45Cf4895C110f464cE857eBE5f270949eC2ff4` | `0xa7DDcA17C9B6E7d16ECf82cE211d67442cB3Df38` |
| TrueDistributor tfTUSD | `0xfB8d918428373f766B352564b70d1DcC1e3b6383` | `0xf06d60a02505c99de700505c0e8f998856aeefe7` |
| TrueDistributor Uni:TUSD/tfTUSD | `0xCc527F4f8c76dB1EBA217d001cCc6f8bD9e0D86E` | `0xf06d60a02505c99de700505c0e8f998856aeefe7` |
| TrueDistributor Uni:ETH/TRU | `0x8EFF7d12118Fd599772D6448CDAd11D5fb2568e0` | `0xf06d60a02505c99de700505c0e8f998856aeefe7` |
| UniswapPair TUSD/tfTUSD | `-` | `0xAC08f19b13548d55294BCEfCf751d81EA65845d5` |
| UniswapPair ETH/TRU | `-` | `0xec6a6b7db761a5c9910ba8fcab98116d384b1b85` |
