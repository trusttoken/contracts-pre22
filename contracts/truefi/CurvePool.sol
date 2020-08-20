// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueFiPool, IERC20} from "./TrueFiPool.sol";

interface ICurve {
    function calc_token_amount(uint256[4] memory amounts, bool deposit) external view returns (uint256);
}

interface ICurvePool {
    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external;

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        uint128 i,
        uint256 min_amount
    ) external;

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);

    function token() external pure returns (IERC20);

    function curve() external pure returns (ICurve);
}

contract YEarnPool is TrueFiPool {
    ICurvePool public curvePool;
    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    constructor(ICurvePool _curve, IERC20 token) public TrueFiPool(token, "CurveTUSDPool", "CurTUSD") {
        curvePool = _curve;
        token.approve(address(curvePool), uint256(-1));
    }

    function join(uint256 amount) external override {
        require(token.transferFrom(msg.sender, address(this), amount));

        uint256[N_TOKENS] memory amounts = [0, 0, 0, amount];
        uint256 minTokenAmount = curvePool.curve().calc_token_amount(amounts, true).mul(99).div(100);

        uint256 balanceBefore = curvePool.token().balanceOf(address(this));
        curvePool.add_liquidity(amounts, minTokenAmount);
        uint256 balanceAfter = curvePool.token().balanceOf(address(this));
        _mint(msg.sender, balanceAfter.sub(balanceBefore));
    }

    function exit(uint256 amount) external override {
        require(amount < balanceOf(msg.sender));

        uint256 minTokenAmount = curvePool.calc_withdraw_one_coin(amount, TUSD_INDEX).mul(99).div(100);

        uint256 balanceBefore = token.balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(amount, TUSD_INDEX, minTokenAmount);
        uint256 balanceAfter = token.balanceOf(address(this));
        require(token.transfer(msg.sender, balanceAfter.sub(balanceBefore)));
        _burn(msg.sender, amount);
    }

    function value() external override view returns (uint256) {
        return curvePool.calc_withdraw_one_coin(1 ether, TUSD_INDEX);
    }
}
