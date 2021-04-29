// SPDX-License-Identifier: MIT
// Copied from https://github.com/sushiswap/sushiswap/blob/master/contracts/interfaces/IRewarder.sol
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Interface for sushiswap rewards
 */
interface ISushiswapRewarder {
    function onSushiReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 sushiAmount,
        uint256 newLpAmount
    ) external;

    function pendingTokens(
        uint256 pid,
        address user,
        uint256 sushiAmount
    ) external view returns (IERC20[] memory, uint256[] memory);
}
