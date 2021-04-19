// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {TrueLender2} from "../TrueLender2.sol";

/**
 * @dev Helper contract to test distribute feature of the TrueLender2
 */
contract TestTrueLender is TrueLender2 {
    function testDistribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) external {
        _distribute(recipient, numerator, denominator, pool);
    }
}
