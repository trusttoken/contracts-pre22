// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDebtToken} from "./IDebtToken.sol";

interface IDeficiencyToken is IERC20 {
    function debt() external view returns (IDebtToken);

    function burnFrom(address account, uint256 amount) external;

    function version() external pure returns (uint8);
}
