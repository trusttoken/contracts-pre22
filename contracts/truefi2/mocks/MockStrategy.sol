// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITrueStrategy} from "../interface/ITrueStrategy.sol";

contract MockStrategy is ITrueStrategy {
    IERC20 token;
    address pool;

    constructor(IERC20 _token, address _pool) public {
        token = _token;
        pool = _pool;
    }

    function deposit(uint256 amount) external override {
        token.transferFrom(pool, address(this), amount);
    }

    function withdraw(uint256 minAmount) external override {
        token.transfer(pool, minAmount);
    }

    function withdrawAll() external override {
        token.transfer(pool, token.balanceOf(address(this)));
    }

    function value() external override view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
