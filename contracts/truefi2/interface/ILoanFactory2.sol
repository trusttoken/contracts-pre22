// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2Deprecated} from "../deprecated/ILoanToken2Deprecated.sol";
import {IFixedTermLoan} from "./IFixedTermLoan.sol";
import {IDebtToken} from "./IDebtToken.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanFactory2 {
    function createLoanToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external returns (IFixedTermLoan);

    function createDebtToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _debt
    ) external returns (IDebtToken);

    function isLegacyLoanToken(ILoanToken2Deprecated) external view returns (bool);

    function isLoanToken(IFixedTermLoan) external view returns (bool);

    function isDebtToken(IDebtToken) external view returns (bool);
}
