## `TrueLender`



TrueFi Lending Strategy
This contract implements the lending strategy for the TrueFi pool
The strategy takes into account several parameters and consumes
information from the prediction market in order to approve loans
This strategy is conservative to avoid defaults.
See: https://github.com/trusttoken/truefi-spec
1. Only approve loans which have the following inherent properties:
- minAPY <= loanAPY <= maxAPY
- minSize <= loanSize <= maxSize
- minTerm <= loanTerm <= maxTerm
2. Only approve loans which have been rated in the prediction market under the conditions:
- timeInMarket >= votingPeriod
- stakedTRU > (participationFactor * loanSize)
- 1 < ( interest * P(loan_repaid) - (loanSize * riskAversion * P(loan_defaults))
Once a loan meets these requirements, fund() can be called to transfer
funds from the pool to the LoanToken contract

### `onlyPool()`



Modifier for only lending pool


### `initialize(contract ITrueFiPool _pool, contract ITrueRatingAgency _ratingAgency, contract IStakingPool _stakingPool)` (public)



Initalize the contract with parameters


### `setStakingPool(contract IStakingPool newPool)` (public)



set stake pool address


### `setSizeLimits(uint256 min, uint256 max)` (external)



Set new bounds on loan size. Only owner can change parameters.


### `setTermLimits(uint256 min, uint256 max)` (external)



Set new bounds on loan term length. Only owner can change parameters.


### `setApyLimits(uint256 newMinApy, uint256 newMaxApy)` (external)



Set new bounds on loan APY. Only owner can change parameters.


### `setVotingPeriod(uint256 newVotingPeriod)` (external)



Set new minimum voting period in credit rating market.
Only owner can change parameters


### `setParticipationFactor(uint256 newParticipationFactor)` (external)



Set new participation factor. Only owner can change parameters.


### `setRiskAversion(uint256 newRiskAversion)` (external)



Set new risk aversion factor. Only owner can change parameters.


### `setLoansLimit(uint256 newLoansLimit)` (external)



Set new loans limit. Only owner can change parameters.


### `setRatingAgency(contract ITrueRatingAgency newRatingAgency)` (external)



Set new rating agency. Only owner can change parameters.


### `loans() → contract ILoanToken[] result` (public)



Get currently funded loans


### `fund(contract ILoanToken loanToken)` (external)



Fund a loan which meets the strategy requirements


### `loanValue(contract ILoanToken loan) → uint256` (public)



Temporary fix for old LoanTokens with incorrect value calculation


### `value() → uint256` (external)



Loop through loan tokens and calculate theoretical value of all loans
There should never be too many loans in the pool to run out of gas


### `reclaim(contract ILoanToken loanToken)` (external)



For settled loans, redeem LoanTokens for underlying funds


### `distribute(address recipient, uint256 numerator, uint256 denominator)` (external)



Withdraw a basket of tokens held by the pool
When exiting the pool, the pool contract calls this function
to withdraw a fraction of all the loans held by the pool
Loop through recipient's share of LoanTokens and calculate versus total per loan.
There should never be too many loans in the pool to run out of gas


### `loanIsAttractiveEnough(uint256 apy) → bool` (public)



Check if a loan is within APY bounds


### `votingLastedLongEnough(uint256 start) → bool` (public)



Check if a loan has been in the credit market long enough


### `loanSizeWithinBounds(uint256 amount) → bool` (public)



Check if a loan is within size bounds


### `loanTermWithinBounds(uint256 term) → bool` (public)



Check if loan term is within term bounds


### `votesThresholdReached(uint256 amount, uint256 yesVotes) → bool` (public)



Check if a loan is within APY bounds
Minimum absolute value of yes votes, rather than ratio of yes to no


### `loanIsCredible(uint256 apy, uint256 term, uint256 yesVotes, uint256 noVotes) → bool` (public)



Use APY and term of loan to check expected value of a loan
Expected value = profit - (default_loss * (no / yes))
e.g. riskAversion = 10,000 => expected value of 1



### `Allowed(address who, bool status)`



Emitted when a borrower's whitelist status changes


### `ApyLimitsChanged(uint256 minApy, uint256 maxApy)`



Emitted when APY bounds have changed


### `ParticipationFactorChanged(uint256 participationFactor)`



Emitted when participation factor changed


### `RiskAversionChanged(uint256 riskAversion)`



Emitted when risk aversion changed


### `VotingPeriodChanged(uint256 votingPeriod)`



Emitted when the minimum voting period is changed


### `SizeLimitsChanged(uint256 minSize, uint256 maxSize)`



Emitted when the loan size bounds are changed


### `TermLimitsChanged(uint256 minTerm, uint256 maxTerm)`



Emitted when loan term bounds are changed


### `LoansLimitChanged(uint256 maxLoans)`



Emitted when loans limit is changed


### `StakingPoolChanged(contract IStakingPool pool)`



Emitted when stakingPool address is changed


### `Funded(address loanToken, uint256 amount)`



Emitted when a loan is funded


### `Reclaimed(address loanToken, uint256 amount)`



Emitted when funds are reclaimed from the LoanToken contract


### `RatingAgencyChanged(address newRatingAgency)`



Emitted when rating agency contract is changed


