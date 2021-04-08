// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueStrategy {
    /**
     * @dev put `amount` of tokens into the strategy
     * As a result of the deposit value of the strategy should increase by at least 98% of amount
     */
    function deposit(uint256 amount) external;

    /**
     * @dev pull at least `minAmount` of tokens from strategy and transfer to the pool
     */
    function withdraw(uint256 minAmount) external;

    /**
     * @dev withdraw everything from strategy
     * As a result of calling withdrawAll(),at least 98% of strategy's value should be transferred to the pool
     * Value must become 0
     */
    function withdrawAll() external;

    /// @dev value evaluated to Pool's tokens
    function value() external view returns (uint256);
}
