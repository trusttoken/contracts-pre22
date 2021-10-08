// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILineOfCreditAgency {
    function poolCreditValue(ITrueFiPool2 pool) external view returns (uint256);

    function proFormaIsOverLimit(address borrower, uint256 stakedAmount) external view returns (bool);
}
