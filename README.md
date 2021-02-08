# 💰 TrueFi Smart Contracts

## 🗂 Table of Contents
- [💡 Intro](#-💡-Intro)
- [📎 Projects](#-📎-Projects)
- [🧰 Installation](#-🧰-Installation)
- [✅ Testing](#-✅-Testing)
- [🚉 Addresses](#-🚉-Addresses)
- [☎️ Contact](#-☎️-Contact)

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
| Registry | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| TrustToken | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| TrueFI Pool | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| TrueLender | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| TrueRatingAgency | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| LoanFactory | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| Farms... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| Distributors... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| Uniswap | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |
| ... | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` | `0xTHAT_IS_JUST_A_MOCK_ADDRESS_FILL_THE_GAP` |


# ☎️ Contact
Websites, twitter handles, etc. Maybe exchanges where key assets are listed.

