// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakingPool is IERC20 {
    function stakeSupply() external view returns (uint256);

    function withdraw(uint256 amount) external;

    function payFee(uint256 amount, uint256 endTime) external;
}
