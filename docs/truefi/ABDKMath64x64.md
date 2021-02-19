## `ABDKMath64x64`

Smart contract library of mathematical functions operating with signed
64.64-bit fixed point numbers.  Signed 64.64-bit fixed point number is
basically a simple fraction whose numerator is signed 128-bit integer and
denominator is 2^64.  As long as denominator is always the same, there is no
need to store it, thus in Solidity signed 64.64-bit fixed point numbers are
represented by int128 type holding only the numerator.




### `fromUInt(uint256 x) → int128` (internal)

Convert unsigned 256-bit integer number into signed 64.64-bit fixed point
number.  Revert on overflow.




### `log_2(int128 x) → int128` (internal)

Calculate binary logarithm of x.  Revert if x <= 0.




### `ln(int128 x) → int128` (internal)

Calculate natural logarithm of x.  Revert if x <= 0.





