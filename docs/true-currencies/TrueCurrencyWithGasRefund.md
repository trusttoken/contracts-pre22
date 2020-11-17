## `TrueCurrencyWithGasRefund`






### `refundGas(uint256 amount)` (external)



reclaim gas from legacy gas refund #1
will refund 15,000 * amount gas to sender (minus exection cost)
If gas pool is empty, refund 39,000 * amount gas by calling selfdestruct


