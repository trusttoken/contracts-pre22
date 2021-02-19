## `TrueRatingAgency`



Credit prediction market for LoanTokens
TrueFi uses use a prediction market to signal how risky a loan is.
The Credit Prediction Market estimates the likelihood of a loan defaulting.
Any TRU holder can vote YES or NO and stake TRU as collateral on their vote.
If a loan is funded, TRU is locked into the market until expiry.
Locking TRU into the prediction market allows voters to earn and claim
incentive TRU throughout the course of the loan. After the loan's term,
if the voter is correct, they earn a TRU reward plus a portion of the
losing side's vote. A portion of the losing side's TRU is burned.
Voting Lifecycle:
- Borrowers can apply for loans at any time by deploying a LoanToken
- LoanTokens are registered with the prediction market contract
- Once registered, TRU holders can vote at any time
- If a loan is funded, TRU is locked for the term of the loan
- At the end of the term, payouts are determined based on the loan outcome
States:
Void:        Rated loan is invalid
Pending:     Waiting to be funded
Retracted:   Rating has been cancelled
Running:     Rated loan has been funded
Settled:     Rated loan has been paid back in full
Defaulted:   Rated loan has not been paid back in full

### `onlyAllowedSubmitters()`



Only whitelisted borrowers can submit for credit ratings

### `onlyCreator(address id)`



Only loan submitter can perform certain actions

### `onlyNotExistingLoans(address id)`



Cannot submit the same loan multiple times

### `onlyPendingLoans(address id)`



Only loans in Pending state

### `onlyNotRunningLoans(address id)`



Only loans in Running state

### `onlyFundedLoans(address id)`



Only loans that have been funded

### `calculateTotalReward(address id)`



Update total TRU reward for a Loan
Reward is divided proportionally based on # TRU staked
chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
interest = (loan APY * term * principal)
R = Total Reward = (interest * chi * rewardFactor)



### `initialize(contract IBurnableERC20 _trustToken, contract IArbitraryDistributor _distributor, contract ILoanFactory _factory)` (public)



Initalize Rating Agenct
Distributor contract decides how much TRU is rewarded to stakers


### `setLossFactor(uint256 newLossFactor)` (external)



Set loss factor.
Loss factor decides what percentage of TRU is lost for incorrect votes


### `setBurnFactor(uint256 newBurnFactor)` (external)



Set burn factor.
Burn factor decides what percentage of lost TRU is burned

### `setRewardMultiplier(uint256 newRewardMultiplier)` (external)



Set reward multiplier.
Reward multiplier increases reward for TRU stakers

### `getNoVote(address id, address voter) → uint256` (public)



Get number of NO votes for a specific account and loan


### `getYesVote(address id, address voter) → uint256` (public)



Get number of YES votes for a specific account and loan


### `getTotalNoVotes(address id) → uint256` (public)



Get total NO votes for a specific loan


### `getTotalYesVotes(address id) → uint256` (public)



Get total YES votes for a specific loan


### `getVotingStart(address id) → uint256` (public)



Get timestamp at which voting started for a specific loan


### `getResults(address id) → uint256, uint256, uint256` (external)



Get current results for a specific loan


### `allow(address who, bool status)` (external)



Whitelist borrowers to submit loans for rating


### `pauseSubmissions(bool status)` (public)



Pause submitting loans for rating


### `submit(address id)` (external)



Submit a loan for rating
Cannot submit the same loan twice


### `retract(address id)` (external)



Remove Loan from rating agency
Can only be retracted by loan creator


### `vote(address id, uint256 stake, bool choice)` (internal)



Vote on a loan by staking TRU


### `yes(address id, uint256 stake)` (external)



Vote YES on a loan by staking TRU


### `no(address id, uint256 stake)` (external)



Vote NO on a loan by staking TRU


### `withdraw(address id, uint256 stake)` (external)



Withdraw stake on a loan and remove votes.
Unstaking only allowed for loans that are not Running


### `bounty(address id, bool incorrectChoice) → uint256` (public)



Total amount of funds given to correct voters


### `toTrustToken(uint256 input) → uint256 output` (internal)



Internal view to convert values to 8 decimals precision


### `claim(address id, address voter)` (public)



Claim TRU rewards for voters
- Only can claim TRU rewards for funded loans
- Voters can claim a portion of their total rewards over time
- Claimed automatically when a user withdraws stake
chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
interest = (loan APY * term * principal)
R = Total Reward = (interest * chi)
R is distributed to voters based on their proportion of votes/total_votes
Claimable reward = R x (current time / total time)

(account TRU staked / total TRU staked) - (amount claimed)


### `claimed(address id, address voter) → uint256` (external)





### `claimable(address id, address voter) → uint256` (public)





### `wasPredictionCorrect(address id, bool choice) → bool` (internal)



Check if a prediction was correct for a specific loan and vote


### `status(address id) → enum TrueRatingAgency.LoanStatus` (public)



Get status for a specific loan
We rely on correct implementation of LoanToken



### `Allowed(address who, bool status)`





### `LossFactorChanged(uint256 lossFactor)`





### `BurnFactorChanged(uint256 burnFactor)`





### `LoanSubmitted(address id)`





### `LoanRetracted(address id)`





### `Voted(address loanToken, address voter, bool choice, uint256 stake)`





### `Withdrawn(address loanToken, address voter, uint256 stake, uint256 received, uint256 burned)`





### `RewardMultiplierChanged(uint256 newRewardMultiplier)`





### `Claimed(address loanToken, address voter, uint256 claimedReward)`





### `SubmissionPauseStatusChanged(bool status)`





