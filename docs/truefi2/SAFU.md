## `SAFU`






### `initialize(contract ILoanFactory2 _loanFactory, contract ILiquidator2 _liquidator, contract I1Inch3 __1Inch)` (public)





### `liquidate(contract ILoanToken2 loan)` (external)



Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
then tries to cover the loan with own funds, to compensate TrueFiPool
If SAFU does not have enough funds, deficit is saved to be redeemed later


### `tokenBalance(contract IERC20 token) → uint256` (public)



Returns SAFU's balance of a specific token


### `redeem(contract ILoanToken2 loan)` (public)



Redeems a loan for underlying repaid debt


### `reclaim(contract ILoanToken2 loan, uint256 amount)` (external)



Reclaims deficit funds, after a loan is repaid and transfers them to the pool


### `swap(bytes data, uint256 minReturnAmount)` (external)



Swap any asset owned by SAFU to any other asset, using 1inch protocol


### `Redeemed(contract ILoanToken2 loan, uint256 burnedAmount, uint256 redeemedAmount)`



Emitted when a loan is redeemed


### `Liquidated(contract ILoanToken2 loan, uint256 repaid, contract IDeficiencyToken deficiencyToken, uint256 deficit)`



Emitted when a loan gets liquidated


### `Reclaimed(contract ILoanToken2 loan, uint256 reclaimed)`



Emitted when a loan deficit is reclaimed


### `Swapped(uint256 amount, address srcToken, uint256 returnAmount, address dstToken)`



Emitted when SAFU swaps assets

