// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2Deprecated} from "../deprecated/ILoanToken2Deprecated.sol";
import {IDebtToken} from "./IDebtToken.sol";

interface ILiquidator2 {
    function legacyLiquidate(ILoanToken2Deprecated loan) external;

    function liquidate(IDebtToken[] calldata debts) external;
}
