// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueFiCreditOracle {
    function getScore(address account) external view returns (uint8);

    function getMaxBorrowerLimit(address account) external view returns (uint256);
}
