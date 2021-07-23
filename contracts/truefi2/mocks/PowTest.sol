// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../libraries/TrueFiFixed64x64.sol";

/**
 * @dev Wrapper over TrueFiFixed64x64 library for testing purposes
 */
contract PowTest {
    function pow(uint256 x, uint256 y) external pure returns (uint256) {
        return
            TrueFiFixed64x64.toUInt(
                TrueFiFixed64x64.fixed64x64Pow(TrueFiFixed64x64.fromUInt(x), TrueFiFixed64x64.fromUInt(y) / 10000)
            );
    }
}
