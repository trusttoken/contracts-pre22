## `LoanToken`



A token which represents share of a debt obligation
Each LoanToken has:
- borrower address
- borrow amount
- loan term
- loan APY
Loan progresses through the following states:
Awaiting:    Waiting for funding to meet capital requirements
Funded:      Capital requirements met, borrower can withdraw
Withdrawn:   Borrower withdraws money, loan waiting to be repaid
Settled:     Loan has been paid back in full with interest
Defaulted:   Loan has not been paid back in full
Liquidated:  Loan has Defaulted and stakers have been Liquidated
- LoanTokens are non-transferable except for whitelisted addresses
- This version of LoanToken only supports a single funder

### `onlyBorrower()`



Only borrower can withdraw & repay loan

### `onlyLiquidator()`



Only liquidator can liquidate

### `onlyClosed()`



Only when loan is Settled

### `onlyOngoing()`



Only when loan is Funded

### `onlyFunded()`



Only when loan is Funded

### `onlyAfterWithdraw()`



Only when loan is Withdrawn

### `onlyAwaiting()`



Only when loan is Awaiting

### `onlyDefaulted()`



Only when loan is Defaulted

### `onlyWhoCanTransfer(address sender)`



Only whitelisted accounts or lender

### `onlyLender()`



Only lender can perform certain actions


### `constructor(contract IERC20 _currencyToken, address _borrower, address _lender, address _liquidator, uint256 _amount, uint256 _term, uint256 _apy)` (public)



Create a Loan


### `isLoanToken() → bool` (external)



Return true if this contract is a LoanToken


### `getParameters() → uint256, uint256, uint256` (external)



Get loan parameters


### `value(uint256 _balance) → uint256` (external)



Get coupon value of this loan token in currencyToken
This assumes the loan will be paid back on time, with interest


### `fund()` (external)



Fund a loan
Set status, start time, lender

### `allowTransfer(address account, bool _status)` (external)



Whitelist accounts to transfer


### `withdraw(address _beneficiary)` (external)



Borrower calls this function to withdraw funds
Sets the status of the loan to Withdrawn


### `close()` (external)



Close the loan and check if it has been repaid

### `liquidate()` (external)



Liquidate the loan if it has defaulted

### `redeem(uint256 _amount)` (external)



Redeem LoanToken balances for underlying currencyToken
Can only call this function after the loan is Closed


### `repay(address _sender, uint256 _amount)` (external)



Function for borrower to repay the loan
Borrower can repay at any time


### `reclaim()` (external)



Function for borrower to reclaim stuck currencyToken
Can only call this function after the loan is Closed
and all of LoanToken holders have been burnt

### `repaid() → uint256` (external)



Check how much was already repaid
Funds stored on the contract's address plus funds already redeemed by lenders


### `balance() → uint256` (external)



Public currency token balance function


### `_balance() → uint256` (internal)



Get currency token balance for this contract


### `receivedAmount() → uint256` (public)



Calculate amount borrowed minus fee


### `interest(uint256 _amount) → uint256` (internal)



Calculate interest that will be paid by this loan for an amount (returned funds included)
amount + ((amount * apy * term) / (365 days / precision))


### `profit() → uint256` (external)



get profit for this loan


### `_transfer(address sender, address recipient, uint256 _amount)` (internal)



Override ERC20 _transfer so only whitelisted addresses can transfer



### `Funded(address lender)`



Emitted when the loan is funded


### `TransferAllowanceChanged(address account, bool status)`



Emitted when transfer whitelist is updated


### `Withdrawn(address beneficiary)`



Emitted when borrower withdraws funds


### `Closed(enum ILoanToken.Status status, uint256 returnedAmount)`



Emitted when term is over


### `Redeemed(address receiver, uint256 burnedAmount, uint256 redeemedAmount)`



Emitted when a LoanToken is redeemed for underlying currencyTokens


### `Repaid(address repayer, uint256 repaidAmount)`



Emitted when a LoanToken is repaid by the borrower in underlying currencyTokens


### `Reclaimed(address borrower, uint256 reclaimedAmount)`



Emitted when borrower reclaims remaining currencyTokens


### `Liquidated(enum ILoanToken.Status status)`



Emitted when loan gets liquidated


