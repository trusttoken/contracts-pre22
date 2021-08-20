// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanFactory2 {
    function createLoanToken(
        ITrueFiPool2 _pool,
        uint256 _amount,
        uint256 _term
    ) external;

    function isLoanToken(address) external view returns (bool);
}
