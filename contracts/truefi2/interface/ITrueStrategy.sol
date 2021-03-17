// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueStrategy {
    /// @dev put `amount` of token kept in Pool into strategy
    function deposit(uint256 amount) external;

    /// @dev pull at least `minAmount` of tokens from strategy
    function withdraw(uint256 minAmount) external;

    /// @dev withdraw everything from strategy
    function withdrawAll() external;

    /// @dev value converted to Pool's tokens
    function value() external view returns (uint256);
}
