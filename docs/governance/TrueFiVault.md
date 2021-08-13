## `TrueFiVault`



Vault for granting TRU tokens from owner to beneficiary after a lockout period.
After the lockout period, beneficiary may withdraw any TRU in the vault.
During the lockout period, the vault still allows beneficiary to stake TRU
and cast votes in governance.

### `onlyBeneficiary()`



Throws if called by any account other than the beneficiary.


### `initialize(address _beneficiary, uint256 _amount, uint256 _start, contract IVoteTokenWithERC20 _tru, contract IStkTruToken _stkTru)` (external)





### `withdrawable(contract IERC20 token) → uint256` (public)





### `withdrawTru(uint256 amount)` (external)



Withdraw vested TRU to beneficiary

### `withdrawStkTru(uint256 amount)` (external)



Withdraw vested stkTRU to beneficiary

### `withdrawToBeneficiary()` (external)



Withdraw all funds to beneficiary after expiry time

### `stake(uint256 amount)` (external)



Stake `amount` TRU in staking contract


### `unstake(uint256 amount)` (external)



unstake `amount` TRU in staking contract


### `cooldown()` (external)



Initiate cooldown for staked TRU

### `claimRewards()` (public)



Claim TRU rewards from staking contract

### `claimRestake()` (external)



Claim TRU rewards, then restake without transferring
Allows account to save more gas by avoiding out-and-back transfers

### `delegate(address delegatee)` (external)



Delegate tru+stkTRU voting power to another address


### `claimFeeRewards()` (external)



Claim rewards in tfTUSD and feeToken from stake and transfer to the beneficiary

### `totalBalance() → uint256` (public)






### `Withdraw(contract IERC20 token, uint256 amount, address beneficiary)`





