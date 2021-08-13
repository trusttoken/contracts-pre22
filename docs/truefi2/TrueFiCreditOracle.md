## `TrueFiCreditOracle`



Contract which allows the storage of credit scores for TrueFi borrower accounts.
Eligible accounts transition to OnHold after creditUpdatePeriod since their last credit update.
OnHold accounts cannot borrow. They transition to Ineligible after gracePeriod.
Ineligible accounts cannot borrow. If they owe outstanding debt, we can trigger a technical default.
Score manager can update scores, but only owner can override eligibility Status
Statuses:
- Eligible: Account can borrow from TrueFi
- OnHold: Account cannot borrow additional funds from TrueFi
- Ineligible: Account cannot borrow from TrueFi, and account can enter default

### `onlyManager()`






### `initialize()` (public)



initialize

### `setCreditUpdatePeriod(uint256 newCreditUpdatePeriod)` (external)



set credit update period to `newCreditUpdatePeriod`

### `setGracePeriod(uint256 newGracePeriod)` (external)



set grace period to `newGracePeriod`

### `status(address account) → enum ITrueFiCreditOracle.Status` (external)



Get borrow status of `account`


### `setScore(address account, uint8 newScore)` (public)



Set `newScore` value for `account`
Scores are stored as uint8 allowing scores of 0-255

### `setMaxBorrowerLimit(address account, uint256 newMaxBorrowerLimit)` (public)



Set `newMaxBorrowerLimit` value for `account`

### `setManager(address newManager)` (public)



Set new manager for updating scores

### `setEligibleForDuration(address account, uint256 duration)` (external)



Manually override Eligible status duration

### `setOnHold(address account)` (external)



Manually override status to OnHold

### `setIneligible(address account)` (external)



Manually override status to Ineligible


### `ManagerChanged(address newManager)`



emit `newManager` when manager changed

### `ScoreChanged(address account, uint8 newScore)`



emit `account`, `newScore` when score changed

### `MaxBorrowerLimitChanged(address account, uint256 newMaxBorrowerLimit)`



emit `account`, `newMaxBorrowerLimit` when max borrow limit changed

### `EligibleUntilTimeChanged(address account, uint256 timestamp)`



emit `account`, `timestamp` when eligiblity time changed

### `CreditUpdatePeriodChanged(uint256 newCreditUpdatePeriod)`



emit `newCreditUpdatePeriod` when credit update period changed

### `GracePeriodChanged(uint256 newGracePeriod)`



emit `newGracePeriod` when grace period changed

