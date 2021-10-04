// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2} from "./ILoanToken2.sol";
import {IDebtToken} from "./IDebtToken.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanFactory2 {
    function createFTLALoanToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external returns (ILoanToken2);

    function createDebtToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _debt
    ) external returns (IDebtToken);

    function isCreatedByFactory(IDebtToken) external view returns (bool);

    function isLoanToken(ILoanToken2) external view returns (bool);

    function isDebtToken(IDebtToken) external view returns (bool);
}
