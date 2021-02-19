## `TrueRatingAgencyV2`



Credit prediction market for LoanTokens
TrueFi uses use a prediction market to signal how risky a loan is.
The Credit Prediction Market estimates the likelihood of a loan defaulting.
Any stkTRU holder can rate YES or NO and stake TRU as collateral on their rate.
Voting weight is equal to delegated governance power (see VoteToken.sol)
If a loan is funded, TRU is rewarded as incentive for participation
Rating stkTRU in the prediction market allows raters to earn and claim TRU
incentive when the loan is approved
Voting Lifecycle:
- Borrowers can apply for loans at any time by deploying a LoanToken
- LoanTokens are registered with the prediction market contract
- Once registered, stkTRU holders can rate at any time
States:
Void:        Rated loan is invalid
Pending:     Waiting to be funded
Retracted:   Rating has been cancelled
Running:     Rated loan has been funded
Settled:     Rated loan has been paid back in full
Defaulted:   Rated loan has not been paid back in full
Liquidated:  Rated loan has defaulted and stakers have been liquidated

### `onlyAllowedSubmitters()`



Only whitelisted borrowers can submit for credit ratings

### `onlyCreator(address id)`



Only loan submitter can perform certain actions

### `onlyNotExistingLoans(address id)`



Cannot submit the same loan multiple times

### `onlyPendingLoans(address id)`



Only loans in Pending state

### `onlyFundedLoans(address id)`



Only loans that have been funded

### `calculateTotalReward(address id)`



Update total TRU reward for a Loan
Reward is divided proportionally based on # TRU staked
chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
interest = (loan APY * term * principal)
R = Total Reward = (interest * chi * rewardFactor)



### `initialize(contract IBurnableERC20 _TRU, contract IVoteTokenWithERC20 _stkTRU, contract IArbitraryDistributor _distributor, contract ILoanFactory _factory)` (public)



Initialize Rating Agency
Distributor contract decides how much TRU is rewarded to stakers


### `setRatersRewardFactor(uint256 newRatersRewardFactor)` (external)



Set rater reward factor.
Reward factor decides what percentage of rewarded TRU is goes to raters

### `setRewardMultiplier(uint256 newRewardMultiplier)` (external)



Set reward multiplier.
Reward multiplier increases reward for TRU stakers

### `getNoRate(address id, address rater) → uint256` (public)



Get number of NO ratings for a specific account and loan


### `getYesRate(address id, address rater) → uint256` (public)



Get number of YES ratings for a specific account and loan


### `getTotalNoRatings(address id) → uint256` (public)



Get total NO ratings for a specific loan


### `getTotalYesRatings(address id) → uint256` (public)



Get total YES ratings for a specific loan


### `getVotingStart(address id) → uint256` (public)



Get timestamp at which voting started for a specific loan


### `getResults(address id) → uint256, uint256, uint256` (external)



Get current results for a specific loan


### `allowChangingAllowances(address who, bool status)` (external)



Allows addresses to whitelist borrowers

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


### `rate(address id, bool choice)` (internal)



Rate on a loan by staking TRU


### `_resetCastRatings(address id, bool choice)` (internal)



Internal function to help reset ratings


### `resetCastRatings(address id)` (public)



Cancel ratings of msg.sender


### `yes(address id)` (external)



Rate YES on a loan by staking TRU


### `no(address id)` (external)



Rate NO on a loan by staking TRU


### `toTRU(uint256 input) → uint256 output` (internal)



Internal view to convert values to 8 decimals precision


### `claim(address id, address rater)` (external)



Claim TRU rewards for raters
- Only can claim TRU rewards for funded loans
- Claimed automatically when a user withdraws stake
chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
interest = (loan APY * term * principal)
R = Total Reward = (interest * chi)
R is distributed to raters based on their proportion of ratings/total_ratings
Claimable reward = R x (current time / total time)

(account TRU staked / total TRU staked) - (amount claimed)


### `claimed(address id, address rater) → uint256` (external)



Get amount claimed for loan ID and rater address


### `claimable(address id, address rater) → uint256` (public)



Get amount claimable for loan ID and rater address


### `status(address id) → enum TrueRatingAgencyV2.LoanStatus` (public)



Get status for a specific loan
We rely on correct implementation of LoanToken



### `CanChangeAllowanceChanged(address who, bool status)`





### `Allowed(address who, bool status)`





### `RatersRewardFactorChanged(uint256 ratersRewardFactor)`





### `LoanSubmitted(address id)`





### `LoanRetracted(address id)`





### `Rated(address loanToken, address rater, bool choice, uint256 stake)`





### `Withdrawn(address loanToken, address rater, uint256 stake, uint256 received, uint256 burned)`





### `RewardMultiplierChanged(uint256 newRewardMultiplier)`





### `Claimed(address loanToken, address rater, uint256 claimedReward)`





### `SubmissionPauseStatusChanged(bool status)`





