// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

contract MockHook {
    uint256[] t;

    function hook() external {
        for (uint256 i = 0; i < 100; i++) {
            t.push(i + 1);
        }
    }
}
