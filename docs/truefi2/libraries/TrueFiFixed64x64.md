## `TrueFiFixed64x64`

Smart contract library of mathematical functions operating with signed
64.64-bit fixed point numbers.  Signed 64.64-bit fixed point number is
basically a simple fraction whose numerator is signed 128-bit integer and
denominator is 2^64.  As long as denominator is always the same, there is no
need to store it, thus in Solidity signed 64.64-bit fixed point numbers are
represented by int128 type holding only the numerator.




### `fromUInt(uint256 x) → int128` (internal)

Convert unsigned 256-bit integer number into signed 64.64-bit fixed point
number.  Revert on overflow.




### `toUInt(int128 x) → uint64` (internal)

Convert signed 64.64 fixed point number into unsigned 64-bit integer
number rounding down.  Revert on underflow.




### `mul(int128 x, int128 y) → int128` (internal)

Calculate x * y rounding down.  Revert on overflow.




### `fixed64x64Pow(int128 x, int128 y) → int128` (internal)

TF-CHANGE Add a new pow implementation that takes 64.64-bit fixed point numbers for both arguments.


calculate x^y using the fact that
x^y = (2^log2(x))^y = 2^(y * log2(x))


### `log_2(int128 x) → int128` (internal)

Calculate binary logarithm of x.  Revert if x <= 0.




### `exp_2(int128 x) → int128` (internal)

Calculate binary exponent of x.  Revert on overflow.





