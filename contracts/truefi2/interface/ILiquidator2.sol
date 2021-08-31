// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDebtToken} from "./IDebtToken.sol";

interface ILiquidator2 {
    function liquidate(IDebtToken loan) external;
}
