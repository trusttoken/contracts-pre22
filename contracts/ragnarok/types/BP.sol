// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

type BP is uint256;

library BPMath {
    function add(BP a, BP b) internal pure returns (BP) {
        return BP.wrap(BP.unwrap(a) + BP.unwrap(b));
    }

    function mul(BP a, uint256 b) internal pure returns (BP) {
        return BP.wrap((BP.unwrap(a) * b));
    }

    function normalize(BP a) internal pure returns (uint256) {
        return BP.unwrap(a) / 10000;
    }
}
