// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDebtToken} from "./ILoanToken2.sol";

interface ILiquidator2 {
    function liquidate(IDebtToken[] calldata loans) external;
}
