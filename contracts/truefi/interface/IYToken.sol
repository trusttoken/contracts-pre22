// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYToken is IERC20 {
    function getPricePerFullShare() external view returns (uint256);
}
