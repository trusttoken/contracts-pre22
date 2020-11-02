// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueLender, ITrueFiPool, ITrueRatingAgency} from "../TrueLender.sol";

contract MockTrueLender is TrueLender {
    function setPool(ITrueFiPool newPool) external {
        pool = newPool;
    }
}
