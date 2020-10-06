// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ITruePool} from "./interface/ITruePool.sol";

/**
 * TruePool is an ERC20 which represents a share of a pool.
 *
 * This contract can be used to wrap opportunities to be compatible
 * with TrueFi and allow users to directly opt-in through the TUSD contract
 *
 * Each TruePool is also a staking opportunity for TRU
 */
abstract contract TruePool is ITruePool, ERC20 {
    IERC20 _currencyToken;

    constructor(
        IERC20 token,
        string memory name,
        string memory symbol
    ) public ERC20(name, symbol) {
        _currencyToken = token;
    }

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
    function join(uint256 amount) external virtual override {
        // TODO
    }

    /**
     * @dev exit pool
     * 1. Transfer pool tokens from sender
     * 2. Exchange pool tokens for TUSD
     * 3. Burn pool tokens
     */
    function exit(uint256 amount) external virtual override {
        // TODO
    }

    /// @dev get token value for pool token
    function value() external virtual override view returns (uint256) {
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

    function currencyToken() public override view returns (IERC20) {
        return _currencyToken;
    }
}
