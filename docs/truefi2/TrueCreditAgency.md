## `LineOfCreditAgency`



Manager for Lines of Credit in the TrueFi Protocol
https://github.com/trusttoken/truefi-spec/blob/master/TrueFi2.0.md#lines-of-credit
- Tracks interest rates and cumulative interest owed
- Data is grouped by score in "buckets" for scalability
- poke() functions used to update state for buckets
- Uses TrueRateAdjuster to calculate rates & limits
- Responsible for approving borrowing from TrueFi pools using Lines of Credit

### `onlyAllowedBorrowers()`



modifier for only whitelisted borrowers


### `initialize(contract ITrueFiCreditOracle _creditOracle, contract ITrueRateAdjuster _rateAdjuster)` (public)



initialize

### `setRateAdjuster(contract ITrueRateAdjuster newRateAdjuster)` (external)



Set rateAdjuster to `newRateAdjuster` and update state

### `setInterestRepaymentPeriod(uint256 newPeriod)` (external)



set interestRepaymentPeriod to `newPeriod`

### `setMinCreditScore(uint256 newValue)` (external)



set minCreditScore to `newValue`

### `allowBorrower(address who, bool isAllowed)` (external)



set borrower `who` to whitelist status `isAllowed`

### `allowPool(contract ITrueFiPool2 pool, bool isAllowed)` (external)



Allow `pool` to be used with lines of credit
Loop through

### `updateCreditScore(contract ITrueFiPool2 pool, address borrower)` (external)



Update credit score for `borrower` in `pool` and refresh state
Can be called by anyone


### `_updateCreditScore(contract ITrueFiPool2 pool, address borrower) → uint8, uint8` (internal)



Internal function to update `borrower` credit score for `pool` using credit oracle


### `creditScoreAdjustmentRate(contract ITrueFiPool2 pool, address borrower) → uint256` (public)



Get credit score adjustment from rate adjuster

### `utilizationAdjustmentRate(contract ITrueFiPool2 pool) → uint256` (public)



Get utilization adjustment from rate adjuster

### `borrowLimitAdjustment(uint8 score) → uint256` (public)



Get borrow limit adjustment from rate adjuster

### `totalTVL(uint8 decimals) → uint256` (public)



Calculate total TVL in USD


### `totalBorrowed(address borrower, uint8 decimals) → uint256` (public)



Get total amount borrowed for `borrower` from lines of credit in USD


### `borrowLimit(contract ITrueFiPool2 pool, address borrower) → uint256` (public)



Get borrow limit for `borrower` in `pool` using rate adjuster


### `currentRate(contract ITrueFiPool2 pool, address borrower) → uint256` (external)



Get current rate for `borrower` in `pool` from rate adjuster


### `interest(contract ITrueFiPool2 pool, address borrower) → uint256` (public)



Get interest rate for `borrower` in `pool` from storage


### `borrow(contract ITrueFiPool2 pool, uint256 amount)` (external)



Borrow from `pool` for `amount` using lines of credit
Only whitelisted borrowers that meet all requirements can borrow


### `payInterest(contract ITrueFiPool2 pool)` (external)



Pay full balance of interest to `pool`
Calling this function resets a timer for when interest payments are due
Borrowers should call this function at least once per payment period


### `repay(contract ITrueFiPool2 pool, uint256 amount)` (public)



Function to repay debt in `pool` for `amount`
Accrued interest is always repaid first before principal
Paying equal to or greater than accrued interest resets next repayment time


### `repayInFull(contract ITrueFiPool2 pool)` (external)



Repay principal and interest for `pool` in a single transaction


### `poke(contract ITrueFiPool2 pool)` (public)



Update state for a pool


### `pokeAll()` (public)



Update state for all pools

### `pokeSingleBucket(contract ITrueFiPool2 pool, uint8 bucketNumber)` (internal)



Internal function to update state for `bucketNumber` in `pool`

### `_pokeSingleBucket(contract ITrueFiPool2 pool, uint8 bucketNumber, uint256 timeNow, uint256 poolRate)` (internal)



Internal function to update state for a single bucket


### `poolCreditValue(contract ITrueFiPool2 pool) → uint256` (external)



Calculate USD value for credit lines in pool


### `singleCreditValue(contract ITrueFiPool2 pool, address borrower) → uint256` (external)



Get value of a single line of credit for `borrower` in `pool`


### `_rebucket(contract ITrueFiPool2 pool, address borrower, uint8 oldScore, uint8 newScore, uint256 updatedBorrowAmount)` (internal)



Move borrower from one bucket to another when borrower score changes


### `_takeOutOfBucket(contract ITrueFiPool2 pool, struct LineOfCreditAgency.CreditScoreBucket bucket, uint8 bucketNumber, address borrower) → uint256 totalBorrowerInterest` (internal)



Internal function to take `borrower` out of a bucket


### `_putIntoBucket(contract ITrueFiPool2 pool, struct LineOfCreditAgency.CreditScoreBucket bucket, uint8 bucketNumber, address borrower)` (internal)



Internal function to put borrower into a bucket


### `_totalBorrowerInterest(contract ITrueFiPool2 pool, struct LineOfCreditAgency.CreditScoreBucket bucket, address borrower) → uint256` (internal)



Internal helper to calculate total borrower interest in a pool based on bucket share


### `_interest(contract ITrueFiPool2 pool, struct LineOfCreditAgency.CreditScoreBucket bucket, address borrower) → uint256` (internal)



Internal function to calculate interest for a single pool 


### `_payInterestWithoutTransfer(contract ITrueFiPool2 pool, uint256 amount)` (internal)



Internal function to change state when msg.sender pays interest
Used before transfer to satisfy check-effects interactions


### `_payPrincipalWithoutTransfer(contract ITrueFiPool2 pool, uint256 amount)` (internal)



Internal function to change state when msg.sender pays principal
Used before transfer to satisfy check-effects interactions


### `_repay(contract ITrueFiPool2 pool, uint256 amount)` (internal)



Internal function used to approve and transfer tokens from agency to pool
Called after "payWithoutTransfer" functions to satisfy check-effects interactions



### `BaseRateOracleChanged(contract ITrueFiPool2 pool, contract ITimeAveragedBaseRateOracle oracle)`



emit `pool` and `oracle` when base rate oracle changed

### `TrueRateAdjusterChanged(contract ITrueRateAdjuster newRateAdjuster)`



emit `newRateAdjuster` when rate adjuster changed

### `BorrowerAllowed(address who, bool isAllowed)`



emit `who` and `isAllowed` when borrower allowance changes

### `PoolAllowed(contract ITrueFiPool2 pool, bool isAllowed)`



emit `pool` and `isAllowed` when pool allowance changes

### `InterestRepaymentPeriodChanged(uint256 newPeriod)`



emit `newPeriod` when interest repayment period changes

### `InterestPaid(contract ITrueFiPool2 pool, address borrower, uint256 amount)`



emit `pool`, `amount` when `borrower` makes an interest payment

### `PrincipalRepaid(contract ITrueFiPool2 pool, address borrower, uint256 amount)`



emit `pool`, `amount` when `borrower` repays principal balance

### `MinCreditScoreChanged(uint256 newValue)`



emit `newValue` when minimum credit score is changed

