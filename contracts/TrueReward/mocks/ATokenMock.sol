// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import { ERC20Mock } from "./ERC20Mock.sol";
import "../IAToken.sol";
import "./LendingPoolCoreMock.sol";

contract ATokenMock is IAToken, ERC20Mock {
    IERC20 public token;
    LendingPoolCoreMock core;
    mapping (address => uint256) public balance;
    uint256 public exchangeRate = 1*10**28;

    constructor(
        IERC20 _token,
        LendingPoolCoreMock _core
    ) public ERC20Mock("ATokenMock", "ATM") {
        token = _token;
        core = _core;
    }

    function mint(address to, uint mintAmount) external {
        balance[to] += shareCountOf(mintAmount);
    }

    function redeem(uint amount) override external {
        uint shares = shareCountOf(amount);
        require(balance[msg.sender] >= shares, "not enough shares");

        balance[msg.sender] -= shares;
        require(token.transfer(msg.sender, underlyingValueOf(shares)), "transfer failed");
    }

    function underlyingValueOf(uint256 shares) internal view returns (uint) {
        return shares * core.getReserveNormalizedIncome(address(token)) / (10**28);
    }

    function shareCountOf(uint256 value) internal view returns (uint) {
        return value * (10**28) / core.getReserveNormalizedIncome(address(token));
    }

    function balanceOf(address owner) override(IERC20, ERC20Mock) public view returns (uint256) {
        return underlyingValueOf(balance[owner]);
    }
}
