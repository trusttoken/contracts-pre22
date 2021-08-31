// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IDebtToken} from "./IDebtToken.sol";

interface ILoanToken2 is IDebtToken {
    function term() external view returns (uint256);

    function apy() external view returns (uint256);

    function start() external view returns (uint256);

    function lender() external view returns (address);

    function profit() external view returns (uint256);

    function getParameters()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function fund() external;

    function withdraw(address _beneficiary) external;

    function settle() external;

    function enterDefault() external;

    function allowTransfer(address account, bool _status) external;
}
