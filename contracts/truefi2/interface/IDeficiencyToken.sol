// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILoanToken2} from "./ILoanToken2.sol";

interface IDeficiencyToken is IERC20 {
    function loan() external view returns (ILoanToken2);

    function burnFrom(address account, uint256 amount) external;

    function version() external pure returns (uint8);
}
