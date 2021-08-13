## `SpotBaseRateOracle`



Oracle to get spot rates from different lending protocols


### `constructor(contract IAaveLendingPool _aaveLendingPool)` (public)



constructor which sets aave pool to `_aaveLendingPool`

### `getRate(address asset) → uint256` (external)



Get rate for an `asset`


### `_getAaveVariableBorrowAPY(address asset) → uint256` (internal)



Internal function to get Aave variable borrow apy for `asset`



