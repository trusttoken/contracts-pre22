## `CreditModel`



Credit Model for interest rates in the TrueFi Protocol
https://github.com/trusttoken/truefi-spec/blob/master/TrueFi2.0.md#lines-of-credit
- Extracts interest rate calculations into a separate contract
- Calculates interest rates for Lines of Credit and Term Loans
- Calculates borrow limits for Lines of Credit and Term Loans
- Includes some adjustable parameters for changing models


### `initialize()` (public)



initializer

### `setRiskPremium(uint256 newRate)` (external)



Set risk premium to `newRate`

### `setCreditAdjustmentCoefficient(uint256 newCoefficient)` (external)



Set credit adjustment coefficient to `newCoefficient`

### `setUtilizationAdjustmentCoefficient(uint256 newCoefficient)` (external)



Set utilization adjustment coefficient to `newCoefficient`

### `setUtilizationAdjustmentPower(uint256 newValue)` (external)



Set utilization adjustment power to `newValue`

### `setBaseRateOracle(contract ITrueFiPool2 pool, contract ITimeAveragedBaseRateOracle _baseRateOracle)` (external)



Set base rate oracle for `pool` to `_baseRateOracle`

### `setFixedTermLoanAdjustmentCoefficient(uint256 newCoefficient)` (external)



Set fixed term adjustment coefficient to `newCoefficient`

### `setBorrowLimitConfig(uint8 scoreFloor, uint16 limitAdjustmentPower, uint16 tvlLimitCoefficient, uint16 poolValueLimitCoefficient)` (external)



Set new borrow limit configuration


### `rate(contract ITrueFiPool2 pool, uint8 score) → uint256` (external)



Get rate given a `pool` and borrower `score`
Rate returned is based on pool utilization and credit score


### `proFormaRate(contract ITrueFiPool2 pool, uint8 score, uint256 amount) → uint256` (external)



Get rate after borrowing `amount` given a `pool` and borrower `score`
Rate returned is based on pool utilization and credit score after borrowing `amount`


### `poolBasicRate(contract ITrueFiPool2 pool) → uint256` (public)



Get interest rate for `pool` adjusted for utilization


### `proFormaPoolBasicRate(contract ITrueFiPool2 pool, uint256 amount) → uint256` (public)



Get interest rate for `pool` adjusted for utilization after borrowing `amount`


### `_poolBasicRate(contract ITrueFiPool2 pool, uint256 _utilizationAdjustmentRate) → uint256` (internal)



Internal function to get basic rate given a `pool` and `_utilizationAdjustmentRate`
basic_rate = min(risk_premium + secured_rate + utilization_adjusted_rate, max_rate)

### `securedRate(contract ITrueFiPool2 pool) → uint256` (public)



Get secured rate for `pool` from a Rate Oracle


### `combinedRate(uint256 partialRate, uint256 __creditScoreAdjustmentRate) → uint256` (public)



Helper function used by poke() to save gas by calculating partial terms of the total rate


### `creditScoreAdjustmentRate(uint8 score) → uint256` (public)



Get rate adjustment based on credit score


### `utilizationAdjustmentRate(contract ITrueFiPool2 pool) → uint256` (public)



Get utilization adjustment rate based on `pool` utilization


### `proFormaUtilizationAdjustmentRate(contract ITrueFiPool2 pool, uint256 amount) → uint256` (public)



Get utilization adjustment rate based on `pool` utilization and `amount` borrowed


### `_utilizationAdjustmentRate(uint256 liquidRatio) → uint256` (internal)



Internal function to calculate utilization adjusted rate given a `liquidRatio`
utilization_adjustment = utilization_adjustment_coefficient * (1/(pool_liquid_ratio)^utilization_adjustment_power - 1)

### `fixedTermLoanAdjustment(uint256 term) → uint256` (public)



Get fixed term loqn adjustment given `term`
stability_adjustment = (term / 30) * stability_adjustment_coefficient


### `borrowLimitAdjustment(uint8 score) → uint256` (public)



Get adjustment for borrow limit based on `score`
limit_adjustment = borrower_score < score_floor ? 0 : (borrower_score/MAX_CREDIT_SCORE)^limit_adjustment_power


### `borrowLimit(contract ITrueFiPool2 pool, uint8 score, uint256 maxBorrowerLimit, uint256 totalTVL, uint256 totalBorrowed) → uint256` (public)



Get borrow limit


### `saturatingSub(uint256 a, uint256 b) → uint256` (internal)



Internal helper to calculate saturating sub of `a` - `b`

### `min(uint256 a, uint256 b) → uint256` (internal)



Internal helper to calculate minimum of `a` and `b`


### `RiskPremiumChanged(uint256 newRate)`



Emit `newRate` when risk premium changed

### `CreditAdjustmentCoefficientChanged(uint256 newCoefficient)`



Emit `newCoefficient` when credit adjustment coefficient changed

### `UtilizationAdjustmentCoefficientChanged(uint256 newCoefficient)`



Emit `newCoefficient` when utilization adjustment coefficient changed

### `UtilizationAdjustmentPowerChanged(uint256 newValue)`



Emit `newValue` when utilization adjustment power changed

### `BaseRateOracleChanged(contract ITrueFiPool2 pool, contract ITimeAveragedBaseRateOracle oracle)`



Emit `pool` and `oracle` when base rate oracle changed

### `FixedTermLoanAdjustmentCoefficientChanged(uint256 newCoefficient)`



Emit `newCoefficient` when fixed term loan adjustment coefficient changed

### `BorrowLimitConfigChanged(uint8 scoreFloor, uint16 limitAdjustmentPower, uint16 tvlLimitCoefficient, uint16 poolValueLimitCoefficient)`



Emit `scoreFloor`, `limitAdjustmentPower`, `tvlLimitCoefficient`, `poolValueLimitCoefficient`
when borrow limit config changed

