// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20WithDecimals} from "./IERC20WithDecimals.sol";

interface IStakingVault {
    function slash(address borrower) external;

    function stakedAmount(address borrower) external view returns (uint256);

    function stakedToken() external view returns (IERC20WithDecimals);
}
