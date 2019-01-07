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

### Admins/...
### TokenController.sol

This contract is the owner of TrueUSD.sol. Consists of an Owner key, Mint Pause Keys,
Mint Key, and Mint Ratify Keys. It's also responsible for configuring constants and upgrading the token contract

### MultiSigOwner.sol

This contract is the owner of TokenController.sol. It turns every function that only the owner can access into a multisig function that requires 2/3 approvals.


### Proxy/...

### ProxyStorage.sol
Storage layout of TrueUSD. Makes upgrades safer.

### HasOwner.sol
Our own implementation of Claimable Contract.

### BurnableTokenWithBounds.sol

This limits the minimum and maximum number of tokens that can be burned (redeemed) at once.

### CompliantToken.sol

This ensures that only users who have passed a KYC/AML check can receive newly minted tokens.
It also allows for blacklisting of bad actors in accordance
with the [TrueCoin Terms of Use](https://www.trusttoken.com/terms-of-use/).

### RedeemableToken.sol

Makes it easier for users to burn tokens (i.e. redeem them for USD) by treating sends to 0x0 as burn operations.

Implements Redemption address feature.

### DepositToken.sol
Allow users to register deposit addresses. 

### GasRefundToken.sol
Enable transfer and mint methods to be sponsored. Reduce gas cost of transfer and mint.

### TrueUSD.sol

This is the top-level ERC20 contract tying together all the previously mentioned functionality.


## Upgrade Process

There are three main parts to the system of smart contracts. TrueUSD Token, TokenController, and MultisigOwner. Each contract will sit behind a delegate proxy contract. So to upgrade, the admin needs to point the implementation in the delegate proxy to a new instance. 

TokenController is the owner of TrueUSD and the also the proxyOwner of TrueUSD proxy
Multisig is the owner of TokenController and the also the proxyOwner of TokenController proxy.
Multisig is also the proxyOwner of its own proxy.

## Testing

Initialize the registry submodule in the root directory:
```bash
git submodule init && git submodule update
```

To run the tests and generate a code coverage report:
```bash
npm install
npm test
```

## Contract Structure

    ├── modularERC20  
    │   ├── AllowanceSheet         
    │   ├── BalanceSheet        
    │   ├── ModularBasicToken        
    │   ├── ModularStandardToken        
    │   ├── ModularBurnableToken        
    │   └── ModularMintableToken                
    ├── Admin                 
    │   ├── TokenController        
    │   └── MultisigOwner               
    ├── Proxy
    │   ├── Proxy        
    │   ├── UpgradeabilityProxy        
    │   └── OwnedUpgradeabilityProxy               
    ├── utilities
    │   ├── FastPauseMints        
    │   └── FastPauseTrueUSD               
    ├── ProxyStorage
    ├── HasOwner
    ├── BurnableTokenWithBounds
    ├── CompliantToken
    ├── RedeemableToken
    ├── DepositToken
    ├── GasRefundToken
    ├── TrueUSD


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
| Huobi     | https://www.huobi.com/    |
| Okex      | https://www.okex.com/     |
| Bittrex   | https://bittrex.com       |
| CoinTiger | https://www.cointiger.pro |
| Upbit     | https://upbit.com/        |
| HBUS      | https://www.hbus.com/     |
