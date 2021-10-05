// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDeficiencyToken} from "./IDeficiencyToken.sol";
import {IDebtToken} from "./IDebtToken.sol";

interface ISAFU {
    function poolDeficit(address pool) external view returns (uint256);

    function deficiencyToken(IDebtToken debt) external view returns (IDeficiencyToken);

    function reclaim(IDebtToken debt, uint256 amount) external;
}
