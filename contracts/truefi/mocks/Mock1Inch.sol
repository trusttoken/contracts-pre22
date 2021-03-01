// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {I1Inch} from "../interface/I1Inch.sol";

contract Mock1Inch is I1Inch {
    function swap(
        address,
        SwapDescription calldata,
        CallDescription[] calldata
    ) external override {}
}
