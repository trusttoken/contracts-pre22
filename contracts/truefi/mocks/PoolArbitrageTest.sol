// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ITrueFiPool, IERC20} from "../interface/ITrueFiPool.sol";

contract PoolArbitrageTest {
    using SafeERC20 for IERC20;

    function joinExit(ITrueFiPool pool) external {
        IERC20 token = pool.currencyToken();
        uint256 balance = token.balanceOf(address(this));
        token.safeApprove(address(pool), balance);
        pool.join(balance);
        pool.exit(pool.balanceOf(address(this)));
    }
}
