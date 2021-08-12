// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueFiCreditOracle {
    enum Status {Eligible, OnHold, Ineligible}

    function status(address account) external view returns (Status);

    function getScore(address account) external view returns (uint8);

    function getMaxBorrowerLimit(address account) external view returns (uint256);
}
