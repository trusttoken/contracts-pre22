// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ITrueRateAdjuster {
    function Rate(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 afterAmountLent
    ) external view returns (uint256);

    function securedRate(ITrueFiPool2 pool) external view returns (uint256);

    function PoolBasicRate(ITrueFiPool2 pool, uint256 afterAmountLent) external view returns (uint256);

    function combinedRate(uint256 partialRate, uint256 __creditScoreAdjustmentRate) external pure returns (uint256);

    function creditScoreAdjustmentRate(uint8 score) external view returns (uint256);

    function UtilizationAdjustmentRate(ITrueFiPool2 pool, uint256 amount) external view returns (uint256);

    function fixedTermLoanAdjustment(uint256 term) external view returns (uint256);

    function borrowLimitAdjustment(uint8 score) external view returns (uint256);

    function borrowLimit(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 maxBorrowerLimit,
        uint256 totalTVL,
        uint256 totalBorrowed
    ) external view returns (uint256);
}
