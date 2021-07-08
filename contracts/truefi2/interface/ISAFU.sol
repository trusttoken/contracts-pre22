// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDeficiencyToken} from "./IDeficiencyToken.sol";
import {ILoanToken2} from "./ILoanToken2.sol";

interface ISAFU {
    function poolDeficit(address pool) external view returns (uint256);

    function deficiencyToken(ILoanToken2 loan) external view returns (IDeficiencyToken);

    function reclaim(ILoanToken2 loan, uint256 amount) external;
}
