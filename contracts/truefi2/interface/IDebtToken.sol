// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface IDebtToken is IERC20 {
    enum Status {Defaulted, Liquidated}

    function borrower() external view returns (address);

    function debt() external view returns (uint256);

    function pool() external view returns (ITrueFiPool2);

    function isLiquidated() external view returns (bool);

    function redeem(uint256 _amount) external;

    function liquidate() external;

    function repaid() external view returns (uint256);

    function balance() external view returns (uint256);

    function token() external view returns (ERC20);

    function version() external pure returns (uint8);
}
