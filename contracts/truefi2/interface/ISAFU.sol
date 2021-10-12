// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDeficiencyToken} from "./IDeficiencyToken.sol";
import {IDebtToken} from "./IDebtToken.sol";
import {ILoanToken2Deprecated} from "../deprecated/ILoanToken2Deprecated.sol";

interface ISAFU {
    function poolDeficit(address pool) external view returns (uint256);

    function legacyDeficiencyToken(ILoanToken2Deprecated loan) external view returns (IDeficiencyToken);

    function deficiencyToken(IDebtToken debt) external view returns (IDeficiencyToken);

    function legacyReclaim(ILoanToken2Deprecated loan, uint256 amount) external;

    function reclaim(IDebtToken debt, uint256 amount) external;
}
