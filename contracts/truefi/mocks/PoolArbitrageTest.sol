// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool, IERC20} from "../interface/ITrueFiPool.sol";

contract PoolArbitrageTest {
    function joinExit(ITrueFiPool pool) external {
        IERC20 token = pool.currencyToken();
        uint256 balance = token.balanceOf(address(this));
        token.approve(address(pool), balance);
        pool.join(balance);
        pool.exit(pool.balanceOf(address(this)));
    }
}
