// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueLender, ITruePool, ITrueRatingAgency} from "../TrueLender.sol";

contract MockTrueLender is TrueLender {
    constructor(ITruePool _pool, ITrueRatingAgency _ratingAgency) public TrueLender(_pool, _ratingAgency) {}

    function setPool(ITruePool newPool) external {
        pool = newPool;
    }
}
