// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAToken is IERC20 {
    function redeem(uint256 _shares) external;
}
