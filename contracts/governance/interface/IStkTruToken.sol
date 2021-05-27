// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVoteToken} from "./IVoteToken.sol";

interface IStkTruToken is IERC20, IVoteToken {
    function stake(uint256 amount) external;

    function unstake(uint256 amount) external;

    function cooldown() external;

    function withdraw(uint256 amount) external;

    function claim() external;

    function claimRewards(IERC20 token) external;

    function claimRestake(uint256 extraStakeAmount) external;
}
