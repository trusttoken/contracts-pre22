// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITrueDistributor} from "./ITrueDistributor.sol";

interface ITrueFarm {
    function stakingToken() external view returns (IERC20);

    function trustToken() external view returns (IERC20);

    function trueDistributor() external view returns (ITrueDistributor);

    function name() external view returns (string memory);

    function totalStaked() external view returns (uint256);

    function stake(uint256 amount) external;

    function unstake(uint256 amount) external;

    function claim() external;

    function exit(uint256 amount) external;
}
