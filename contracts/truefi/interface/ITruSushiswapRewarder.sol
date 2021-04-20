// SPDX-License-Identifier: MIT
// Copied from https://github.com/sushiswap/sushiswap/blob/master/contracts/interfaces/IRewarder.sol

pragma solidity 0.6.12;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
interface IRewarder {
    using BoringERC20 for IERC20;
    function onSushiReward(uint256 pid, address user, address recipient, uint256 sushiAmount, uint256 newLpAmount) external;
    function pendingTokens(uint256 pid, address user, uint256 sushiAmount) external returns (IERC20[] memory, uint256[] memory);
}