// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ITrueFiPool} from "./ITrueFiPool.sol";

/**
 * TrueFiPool is an ERC20 which represents a share of a pool.
 * 
 * This contract can be used to wrap opportunities to be compatible
 * with TrueFi and allow users to directly opt-in through the TUSD contract
 *
 * Each TrueFiPool is also a staking opportunity for TRU
 */
contract TrueFiPool is ITrueFiPool, ERC20 {

    constructor () public ERC20("Loan Token", "LOAN") {}
    
    /// @dev only TrueFi smart contract
    modifier onlyTrueFi() {
        _;
    }

    /// @dev update paramaters
    function update(bytes32 params) external onlyTrueFi {
        // TODO 
        // do we need this function, or do updates happen via proxy upgrades?
    }

    /**
     * @dev join pool
     * 1. Transfer TUSD from sender
     * 2. Exchange TUSD for pool tokens
     */
    function join(uint256 amount) external override {
        // TODO
    }

    /**
     * @dev exit pool
     * 1. Transfer pool tokens from sender
     * 2. Exchange pool tokens for TUSD
     * 3. Burn pool tokens
     */
    function exit(uint256 amount) external override {
        // TODO
    }

    /// @dev calculate and update token value internally
    function drip() external override returns (uint256) {
        // TODO
        return 0;
    }

    /// @dev get token value for pool token
    function value() external override pure returns (uint256) {
        // TODO
        return 0;
    }

    /// @dev stake TRU
    function stake(uint256 amount) external override {
        // TODO
    }

    /// @dev unstake TRU
    function unstake(uint256 amount) external override {
        // TODO
    }
}