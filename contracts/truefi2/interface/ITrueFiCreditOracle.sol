// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueFiCreditOracle {
    enum Status {Eligible, OnHold, Ineligible}

    function status(address account) external view returns (Status);

    function score(address account) external view returns (uint8);

    function maxBorrowerLimit(address account) external view returns (uint256);
}
