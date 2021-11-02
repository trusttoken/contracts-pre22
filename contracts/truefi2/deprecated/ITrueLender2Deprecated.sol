// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";
import {ILoanToken2Deprecated} from "../deprecated/ILoanToken2Deprecated.sol";

interface ITrueLender2Deprecated {
    // @dev calculate overall value of the pools
    function value(ITrueFiPool2 pool) external view returns (uint256);

    // @dev distribute a basket of tokens for exiting user
    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external;

    function transferAllLoanTokens(ILoanToken2Deprecated loan, address recipient) external;
}
