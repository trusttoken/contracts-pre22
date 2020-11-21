// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITrueDistributor {
    function trustToken() external view returns (IERC20);

    function farm() external view returns (address);

    function distribute() external;

    function nextDistribution() external view returns (uint256);

    function empty() external;
}
