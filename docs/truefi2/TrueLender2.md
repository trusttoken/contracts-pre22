## `TrueLender2Deprecated`



Loans management helper
This contract is a bridge that helps to transfer funds from pool to the loans and back
TrueLender holds all LoanTokens and may distribute them on pool exits

### `onlyPool()`



Can be only called by a pool


### `initialize(contract IStakingPool _stakingPool, contract IPoolFactory _factory, contract ITrueRatingAgency _ratingAgency, contract I1Inch3 __1inch, contract ITrueFiCreditOracle _creditOracle)` (public)



Initialize the contract with parameters


### `setCreditOracle(contract ITrueFiCreditOracle _creditOracle)` (external)



Set new credit oracle address.
Only owner can change credit oracle


### `setVotingPeriod(uint256 newVotingPeriod)` (external)



Set new minimum voting period in credit rating market.
Only owner can change parameters


### `setMinVotes(uint256 newMinVotes)` (external)



Set new minimal amount of votes for loan to be approved. Only owner can change parameters.


### `setMinRatio(uint256 newMinRatio)` (external)



Set new yes to no votes ratio. Only owner can change parameters.


### `setMaxLoanTerm(uint256 _maxLoanTerm)` (external)



Set max loan term. Only owner can change parameters.


### `setLongTermLoanThreshold(uint256 _longTermLoanThreshold)` (external)



Set minimal term of a long term loan. Only owner can change parameters.


### `setLongTermLoanScoreThreshold(uint8 _longTermLoanScoreThreshold)` (external)



Set long term loan credit score threshold. Only owner can change parameters.


### `setLoansLimit(uint256 newLoansLimit)` (external)



Set new loans limit. Only owner can change parameters.


### `setFeePool(contract ITrueFiPool2 newFeePool)` (external)



Set new fee pool and fee token.
Only owner can change parameters


### `setFee(uint256 newFee)` (external)



Set loan interest fee that goes to the stakers.


### `loans(contract ITrueFiPool2 pool) → contract ILoanToken2[] result` (public)



Get currently funded loans for a pool


### `fund(contract ILoanToken2 loanToken)` (external)



Fund a loan
LoanToken should be created by the LoanFactory over the pool
than was also created by the PoolFactory.
Method should be called by the loan borrower
When called, lender takes funds from the pool, gives it to the loan and holds all LoanTokens
Origination fee is transferred to the stake


### `value(contract ITrueFiPool2 pool) → uint256` (external)



Loop through loan tokens for the pool and calculate theoretical value of all loans
There should never be too many loans in the pool to run out of gas


### `reclaim(contract ILoanToken2 loanToken, bytes data)` (external)



For settled loans, redeem LoanTokens for underlying funds


### `_redeemAndRepay(contract ILoanToken2 loanToken, contract ITrueFiPool2 pool, bytes data) → uint256` (internal)



Helper function to redeem funds from `loanToken` and repay them into the `pool`


### `_swapFee(contract ITrueFiPool2 pool, contract ILoanToken2 loanToken, bytes data) → uint256` (internal)



Swap `token` for `feeToken` on 1inch

### `_transferFeeToStakers()` (internal)



Deposit feeToken to pool and transfer LP tokens to the stakers

### `distribute(address recipient, uint256 numerator, uint256 denominator)` (external)



Withdraw a basket of tokens held by the pool
Function is expected to be called by the pool
When exiting the pool, the pool contract calls this function
to withdraw a fraction of all the loans held by the pool
Loop through recipient's share of LoanTokens and calculate versus total per loan.
There should never be too many loans in the pool to run out of gas


### `transferAllLoanTokens(contract ILoanToken2 loan, address recipient)` (external)



Allow pool to transfer all LoanTokens to the SAFU in case of liquidation


### `_transferAllLoanTokens(contract ILoanToken2 loan, address recipient)` (internal)





### `votingLastedLongEnough(uint256 start) → bool` (public)



Check if a loan has been in the credit market long enough


### `votesThresholdReached(uint256 votes) → bool` (public)



Check if a loan has enough votes to be approved


### `loanIsCredible(uint256 yesVotes, uint256 noVotes) → bool` (public)



Check if yes to no votes ratio reached the minimum rate


### `_distribute(address recipient, uint256 numerator, uint256 denominator, address pool)` (internal)



Helper used in tests

### `_transferLoan(contract ILoanToken2 loan, address recipient, uint256 numerator, uint256 denominator)` (internal)





### `isCredibleForTerm(uint256 term) → bool` (internal)





### `isTermBelowMax(uint256 term) → bool` (internal)






### `LoansLimitChanged(uint256 maxLoans)`



Emitted when loans limit is changed


### `MinVotesChanged(uint256 minVotes)`



Emitted when minVotes changed


### `MinRatioChanged(uint256 minRatio)`



Emitted when risk aversion changed


### `MaxLoanTermChanged(uint256 maxLoanTerm)`



Emitted when max loan term changed


### `LongTermLoanThresholdChanged(uint256 longTermLoanThreshold)`



Emitted when long term loan's minimal term changed


### `LongTermLoanScoreThresholdChanged(uint256 longTermLoanScoreThreshold)`



Emitted when minimal credit score threshold for long term loan changed


### `VotingPeriodChanged(uint256 votingPeriod)`



Emitted when the minimum voting period is changed


### `FeeChanged(uint256 newFee)`



Emitted when loan fee is changed


### `FeePoolChanged(contract ITrueFiPool2 newFeePool)`



Emitted when fee pool is changed


### `CreditOracleChanged(contract ITrueFiCreditOracle newCreditOracle)`



Emitted when credit oracle is changed


### `Funded(address pool, address loanToken, uint256 amount)`



Emitted when a loan is funded


### `Reclaimed(address pool, address loanToken, uint256 amount)`



Emitted when funds are reclaimed from the LoanToken contract


