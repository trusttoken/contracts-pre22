// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IDeficiencyToken} from "./IDeficiencyToken.sol";
import {ILoanToken2} from "./ILoanToken2.sol";

interface ISAFU {
    function liquidate(ILoanToken2 loan) external;

    function tokenBalance(IERC20 token) external view returns (uint256);

    function poolDeficit(address pool) external view returns (uint256);

    function deficiencyToken(ILoanToken2 loan) external view returns (IDeficiencyToken);

    function reclaim(ILoanToken2 loan, uint256 amount) external;
}
