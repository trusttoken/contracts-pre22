// SPDX-License-Identifier: MIT
pragma solidity ^0.6.10;

import {ABDKMath64x64} from "../Log.sol";

contract MockLog {
    using ABDKMath64x64 for uint256;
    using ABDKMath64x64 for int128;

    function ln(uint256 x) public pure returns (int128) {
        return x.fromUInt().ln();
    }
}
