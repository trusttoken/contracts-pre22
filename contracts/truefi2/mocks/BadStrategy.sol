// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ITrueStrategy} from "../interface/ITrueStrategy.sol";

contract BadStrategy is ITrueStrategy {
    using SafeMath for uint256;

    IERC20 token;
    address pool;
    uint256 error;

    constructor(IERC20 _token, address _pool) public {
        token = _token;
        pool = _pool;
        error = 0;
    }

    function deposit(uint256 amount) external override {
        token.transferFrom(pool, address(this), withError(amount));
    }

    function withdraw(uint256 minAmount) external override {
        token.transfer(pool, withError(minAmount));
    }

    function withdrawAll() external override {
        uint256 amount = token.balanceOf(address(this));
        token.transfer(pool, withError(amount));
    }

    function value() external override view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function setErrorPercents(uint256 _error) external {
        error = _error;
    }

    function withError(uint256 amount) public view returns (uint256) {
        return amount.mul(10000 - error).div(10000);
    }
}
