// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ITrueLender2 {
    // @dev calculate overall value of the pools
    function value(ITrueFiPool2 pool) external view returns (uint256);

    // @dev distribute a basket of tokens for exiting user
    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external;
}
