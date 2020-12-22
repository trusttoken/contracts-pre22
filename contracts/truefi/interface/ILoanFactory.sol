// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ILoanFactory {
    function createLoanToken(
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external;

    function isLoanToken(address) external view returns (bool);
}
