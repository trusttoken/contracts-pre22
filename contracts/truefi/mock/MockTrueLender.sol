// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueLender, ITruePool, ITrueRatingAgency} from "../TrueLender.sol";

contract MockTrueLender is TrueLender {
    function setPool(ITruePool newPool) external {
        pool = newPool;
    }
}
