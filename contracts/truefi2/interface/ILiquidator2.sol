// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2} from "./ILoanToken2.sol";

interface ILiquidator2 {
    function liquidate(ILoanToken2 loan) external;
}
