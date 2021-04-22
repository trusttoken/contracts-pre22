// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITrueDistributor} from "../../truefi/interface/ITrueDistributor.sol";

interface ITrueMultiFarm {
    function trueDistributor() external view returns (ITrueDistributor);

    function stake(address token, uint256 amount) external;

    function unstake(address token, uint256 amount) external;

    function claim(address[] calldata tokens) external;

    function exit(address[] calldata tokens) external;
}
