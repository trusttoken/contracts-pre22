// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanToken2 is IERC20 {
    enum Status {Withdrawn, Settled, Defaulted}

    function redeem() external;

    function status() external view returns (Status);

    function interest() external view returns (uint256);

    function debt() external view returns (uint256);

    function tokenValue(address holder) external view returns (uint256);

    function pool() external view returns (ITrueFiPool2);
}
