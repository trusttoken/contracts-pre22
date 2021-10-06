# 💰 TrueFi Smart Contracts

## 🗂 Table of Contents
- [💡 Intro](#-💡-Intro)
- [📎 Projects](#-📎-Projects)
- [🧰 Installation](#-🧰-Installation)
- [✅ Testing](#-✅-Testing)
- [🛡 Coverage](#-🛡-Coverage)  
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

# 🛡 Coverage
Before proceeding make sure you have the smart contracts compiled.
If needed compile by running
```
yarn build
```
In order to run coverage, run 
```
yarn coverage
```
You may also want to run coverage for specific tests.
You can do so by providing named argument `--testfiles`
```
yarn coverage --testfiles "path/to/tests"
```
**Important note:** Keep in mind that when running coverage smart contracts are additionally compiled with optimizer disabled and
it may take longer for tests to complete.

# 🚉 Addresses
## Mainnet
| Contract | Proxy Address |
|:-------:|:-------:|
| TrueUSD | [`0x0000000000085d4780B73119b644AE5ecd22b376`](https://etherscan.io/address/0x0000000000085d4780B73119b644AE5ecd22b376) |
| TrueGBP | [`0x00000000441378008EA67F4284A57932B1c000a5`](https://etherscan.io/address/0x00000000441378008EA67F4284A57932B1c000a5) |
| TrueAUD | [`0x00006100f7090010005f1bd7ae6122c3c2cf0090`](https://etherscan.io/address/0x00006100f7090010005f1bd7ae6122c3c2cf0090) |
| TrueCAD | [`0x00000100F2A2bd000715001920eB70D229700085`](https://etherscan.io/address/0x00000100F2A2bd000715001920eB70D229700085) |
| TrueHKD | [`0x0000852600CEB001E08e00bC008be620d60031F2`](https://etherscan.io/address/0x0000852600CEB001E08e00bC008be620d60031F2) |
| Registry | [`0x0000000000013949f288172bd7e36837bddc7211`](https://etherscan.io/address/0x0000000000013949f288172bd7e36837bddc7211) |
| TrueFi | [`0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784`](https://etherscan.io/address/0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784) || TrustToken | [`0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784`](https://etherscan.io/address/0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784) |
| Staked TrueFi | [`0x23696914Ca9737466D8553a2d619948f548Ee424`](https://etherscan.io/address/0x23696914Ca9737466D8553a2d619948f548Ee424) |
| TrueFi Pool | [`0xa1e72267084192Db7387c8CC1328fadE470e4149`](https://etherscan.io/address/0xa1e72267084192Db7387c8CC1328fadE470e4149) |
| TrueLender | [`0x16d02Dc67EB237C387023339356b25d1D54b0922`](https://etherscan.io/address/0x16d02Dc67EB237C387023339356b25d1D54b0922) |
| TrueRatingAgency | [`0x05461334340568075bE35438b221A3a0D261Fb6b`](https://etherscan.io/address/0x05461334340568075bE35438b221A3a0D261Fb6b)|
| LoanFactory | [`0x4ACE6dE67E9a9EDFf5c2d0a584390Fb5394119e7`](https://etherscan.io/address/0x4ACE6dE67E9a9EDFf5c2d0a584390Fb5394119e7) |
| TrueFi LP Farm | [`0x8FD832757F58F71BAC53196270A4a55c8E1a29D9`](https://etherscan.io/address/0x8FD832757F58F71BAC53196270A4a55c8E1a29D9) |
| Uniswap TUSD/TFI-LP Farm | [`0xf8F14Fbb93fa0cEFe35Acf7e004fD4Ef92d8315a`](https://etherscan.io/address/0xf8F14Fbb93fa0cEFe35Acf7e004fD4Ef92d8315a) |
| Uniswap ETH/TRU Farm | [`0xED45Cf4895C110f464cE857eBE5f270949eC2ff4`](https://etherscan.io/address/0xED45Cf4895C110f464cE857eBE5f270949eC2ff4) |
| tfTUSD Distributor | [`0xfB8d918428373f766B352564b70d1DcC1e3b6383`](https://etherscan.io/address/0xfB8d918428373f766B352564b70d1DcC1e3b6383) |
| Uni TUSD/tfTUSD Distributor | [`0xCc527F4f8c76dB1EBA217d001cCc6f8bD9e0D86E`](https://etherscan.io/address/0xCc527F4f8c76dB1EBA217d001cCc6f8bD9e0D86E) |
| Uni ETH/TRU Distributor | [`0x8EFF7d12118Fd599772D6448CDAd11D5fb2568e0`](https://etherscan.io/address/0x8EFF7d12118Fd599772D6448CDAd11D5fb2568e0) || Uni ETH/TRU Distributor | [`0x8EFF7d12118Fd599772D6448CDAd11D5fb2568e0`](https://etherscan.io/address/0x8EFF7d12118Fd599772D6448CDAd11D5fb2568e0) |
| RatingAgencyV2Distributor | [`0x6151570934470214592AA051c28805cF4744BCA7`](https://etherscan.io/address/0x6151570934470214592AA051c28805cF4744BCA7) |
| stkTRUDistributor | [`0xecfD4F2C07EABdb7b592308732B59713728A957F`](https://etherscan.io/address/0xecfD4F2C07EABdb7b592308732B59713728A957F) |
| Uniswap Router | [`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`](https://etherscan.io/address/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D) |
| Uniswap Factory | [`0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`](https://etherscan.io/address/0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f) |

# ☎️ Contact
 - [TrueFi main website](https://truefi.io/)
 - [TrueFi Twitter](https://twitter.com/TrustToken)
 - [Join TrueFi Discord](https://discord.com/invite/3tMyMqyqDj)
 - [TrueFi app](https://app.truefi.io/dashboard?utm_source=marketing_site&utm_medium=launch_app)
 - [FAQ](https://docs.truefi.io/faq/)