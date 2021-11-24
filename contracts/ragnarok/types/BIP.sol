// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

type BIP is uint256;

library BIPMath {
    function add(BIP a, BIP b) internal pure returns (BIP c) {
        c = BIP.wrap(BIP.unwrap(a) + BIP.unwrap(b));
    }

    function mul(BIP a, uint256 b) internal pure returns (uint256 c) {
        c = (BIP.unwrap(a) * b) / 10000;
    }
}
