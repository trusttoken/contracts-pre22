// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICurvePool, ICurve} from "../ICurvePool.sol";
import {MockERC20Token} from "../../trusttokens/mocks/MockERC20Token.sol";

contract MockCurve is ICurve {
    uint256 public sharePrice = 1e18;

    function calc_token_amount(uint256[4] memory amounts, bool deposit) external override view returns (uint256) {
        return (amounts[3] * sharePrice) / 1e18;
    }

    function set_withdraw_price(uint256 price) external {
        sharePrice = price;
    }
}

contract MockCurvePool is ICurvePool {
    IERC20 poolToken;
    MockERC20Token cToken;
    MockCurve _curve;

    constructor(IERC20 _token) public {
        poolToken = _token;
        cToken = new MockERC20Token();
        _curve = new MockCurve();
    }

    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external override {
        poolToken.transferFrom(msg.sender, address(this), amounts[3]);
        cToken.mint(msg.sender, (amounts[3] * 1e18) / _curve.sharePrice());
    }

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        uint128 i,
        uint256 min_amount
    ) external override {
        cToken.transferFrom(msg.sender, address(this), _token_amount);
        poolToken.transfer(msg.sender, (_token_amount * _curve.sharePrice()) / 1e18);
        cToken.burn(_token_amount);
    }

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external override view returns (uint256) {
        return _curve.sharePrice();
    }

    function set_withdraw_price(uint256 price) external {
        _curve.set_withdraw_price(price);
    }

    function token() external override view returns (IERC20) {
        return IERC20(address(cToken));
    }

    function curve() external override view returns (ICurve) {
        return _curve;
    }
}
