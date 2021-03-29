// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueFiPool2, IERC20} from "../TrueFiPool2.sol";

contract Pool2ArbitrageTest {
    function joinExit(TrueFiPool2 pool) external {
        IERC20 token = pool.token();
        uint256 balance = token.balanceOf(address(this));
        token.approve(address(pool), balance);
        pool.join(balance);
        pool.exit(pool.balanceOf(address(this)));
    }
}
