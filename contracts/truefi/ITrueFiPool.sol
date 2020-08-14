// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * TrueFiPool is an ERC20 which represents a share of a pool.
 * 
 * This contract can be used to wrap opportunities to be compatible
 * with TrueFi and allow users to directly opt-in through the TUSD contract
 *
 * Each TrueFiPool is also a staking opportunity for TRU
 */
interface ITrueFiPool is IERC20 {
    /**
     * @dev join pool
     * 1. Transfer TUSD from sender
     * 2. Mint pool tokens based on value to sender
     */
    function join(uint256 amount) external;

    /**
     * @dev exit pool
     * 1. Transfer pool tokens from sender
     * 2. Burn pool tokens
     * 3. Transfer value of pool tokens in TUSD to sender
     */
    function exit(uint256 amount) external;

    /// @dev calculate and update pool token value internally
    /// Do we need this?
    function drip() external returns (uint256);

    /// @dev get token value for pool token
    function value() external pure returns (uint256);

    /// @dev stake TRU
    function stake(uint256 amount) external;

    /// @dev unstake TRU
    function unstake(uint256 amount) external;
}