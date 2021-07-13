// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../libraries/ABDKMath64x64.sol";

contract PowTest {
    function pow(uint256 x, uint256 y) external pure returns (uint256) {
        return ABDKMath64x64.toUInt(ABDKMath64x64.pow(ABDKMath64x64.fromUInt(x), y));
    }
}
