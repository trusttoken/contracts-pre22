// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueFiPool, IERC20} from "./TrueFiPool.sol";

interface IYEarn is IERC20 {
    function deposit(uint256 _amount) external;

    function withdraw(uint256 _shares) external;

    function getPricePerFullShare() external view returns (uint256);
}

contract YEarnPool is TrueFiPool {
    IYEarn public yearn;

    constructor(IYEarn _yearn, IERC20 token) public TrueFiPool(token, "YearnTUSDPool", "YTUSD-P") {
        yearn = _yearn;
    }

    function join(uint256 amount) external override {
        require(token.transferFrom(msg.sender, address(this), amount));
        uint256 balanceBefore = yearn.balanceOf(address(this));
        yearn.deposit(amount);
        uint256 balanceAfter = yearn.balanceOf(address(this));
        _mint(msg.sender, balanceAfter.sub(balanceBefore));
    }

    function exit(uint256 amount) external override {
        require(amount < balanceOf(msg.sender));
        uint256 balanceBefore = token.balanceOf(address(this));
        yearn.withdraw(amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        require(token.transfer(msg.sender, balanceAfter.sub(balanceBefore)));
        _burn(msg.sender, amount);
    }

    function value() external override view returns (uint256) {
        return yearn.getPricePerFullShare();
    }
}
