// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {TrueFiPool2} from "../TrueFiPool2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Pool2ArbitrageTest {
    using SafeERC20 for IERC20;

    function joinExit(TrueFiPool2 pool) external {
        IERC20 token = pool.token();
        uint256 balance = token.balanceOf(address(this));
        token.safeApprove(address(pool), balance);
        pool.join(balance);
        pool.exit(pool.balanceOf(address(this)));
    }
}
