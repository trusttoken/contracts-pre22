// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanToken2} from "./ILoanToken2.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanFactory2 {
    function createLoanToken(
        ITrueFiPool2 _pool,
        uint256 _amount,
        uint256 _term,
        uint256 _maxApy
    ) external;

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
    ) external;

    function isCreatedByFactory(address) external view returns (bool);

    function isLoanToken(address) external view returns (bool);

    function isDebtToken(address) external view returns (bool);
}
