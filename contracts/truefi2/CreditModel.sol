// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITimeAveragedBaseRateOracle} from "./interface/ITimeAveragedBaseRateOracle.sol";
import {ICreditModel} from "./interface/ICreditModel.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {TrueFiFixed64x64} from "./libraries/TrueFiFixed64x64.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

/**
 * @title TrueFi Credit Model
 * @dev Credit Model for interest rates in the TrueFi Protocol
 * https://github.com/trusttoken/truefi-spec/blob/master/TrueFi2.0.md#lines-of-credit
 *
 * - Extracts interest rate calculations into a separate contract
 * - Calculates interest rates for Lines of Credit and Term Loans
 * - Calculates borrow limits for Lines of Credit and Term Loans
 * - Includes some adjustable parameters for changing models
 */
contract CreditModel is ICreditModel, UpgradeableClaimable {
    using SafeMath for uint256;
    using TrueFiFixed64x64 for int128;

    /// @dev basis precision: 10000 = 100%
    uint16 constant BASIS_POINTS = 10000;

    /// @dev maximum interest rate in basis points
    uint256 constant MAX_RATE_CAP = 5 * BASIS_POINTS;

    /// @dev credit score is stored as uint(8)
    uint8 constant MAX_CREDIT_SCORE = 255;

    struct UtilizationRateConfig {
        // proportional coefficient: utilization-adjusted rate % (basis precision)
        uint16 coefficient;
        // inverse power factor (full precision -- no rational powers)
        uint16 power;
    }

    struct CreditScoreRateConfig {
        // proportional coefficient: credit-score-adjusted rate % (basis precision)
        uint16 coefficient;
        // inverse power factor (full precision -- no rational powers)
        uint16 power;
    }

    /// @dev holds data to configure borrow limits
    struct BorrowLimitConfig {
        // minimum score
        uint8 scoreFloor;
        // adjust aggressiveness of curve (basis precision)
        uint16 limitAdjustmentPower;
        // adjust for TVL (basis precision)
        uint16 tvlLimitCoefficient;
        // adjust for pool value (basis precision)
        uint16 poolValueLimitCoefficient;
        uint16 ltvRatio;
        uint16 effectiveScorePower;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    UtilizationRateConfig public utilizationRateConfig;

    CreditScoreRateConfig public creditScoreRateConfig;

    // @dev premium rate for uncollateralized landing (basis precision)
    uint256 public riskPremium;

    /// @dev interest rate adjustment per each 30 days for term loans (basis precision)
    uint256 public fixedTermLoanAdjustmentCoefficient;

    /// @dev Base rate oracles stored for each pool
    mapping(ITrueFiPool2 => ITimeAveragedBaseRateOracle) public baseRateOracle;

    /// @dev store borrow limit configuration
    BorrowLimitConfig public borrowLimitConfig;

    /// @dev used for TVL calculations
    IPoolFactory public poolFactory;

    // ======= STORAGE DECLARATION END ============

    /// @dev Emit `newRate` when risk premium changed
    event RiskPremiumChanged(uint256 newRate);

    /// @dev Emit `newCoefficient` when credit adjustment coefficient changed
    event CreditScoreRateConfigChanged(uint16 coefficient, uint16 power);

    event UtilizationRateConfigChanged(uint16 coefficient, uint16 power);

    /// @dev Emit `pool` and `oracle` when base rate oracle changed
    event BaseRateOracleChanged(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle oracle);

    /// @dev Emit `newCoefficient` when fixed term loan adjustment coefficient changed
    event FixedTermLoanAdjustmentCoefficientChanged(uint256 newCoefficient);

    /**
     * @dev Emit `scoreFloor`, `limitAdjustmentPower`, `tvlLimitCoefficient`, `poolValueLimitCoefficient`
     * when borrow limit config changed
     */
    event BorrowLimitConfigChanged(
        uint8 scoreFloor,
        uint16 limitAdjustmentPower,
        uint16 tvlLimitCoefficient,
        uint16 poolValueLimitCoefficient,
        uint16 ltvRatio,
        uint16 effectiveScorePower
    );

    /// @dev initializer
    function initialize(IPoolFactory _poolFactory) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = 200;
        utilizationRateConfig = UtilizationRateConfig(50, 2);
        creditScoreRateConfig = CreditScoreRateConfig(1000, 1);
        fixedTermLoanAdjustmentCoefficient = 25;
        borrowLimitConfig = BorrowLimitConfig(40, 7500, 1500, 1500, 4000, 1);
        poolFactory = _poolFactory;
    }

    /// @dev Set risk premium to `newRate`
    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        emit RiskPremiumChanged(newRate);
    }

    function setCreditScoreRateConfig(uint16 coefficient, uint16 power) external onlyOwner {
        creditScoreRateConfig = CreditScoreRateConfig(coefficient, power);
        emit CreditScoreRateConfigChanged(coefficient, power);
    }

    function setUtilizationRateConfig(uint16 coefficient, uint16 power) external onlyOwner {
        utilizationRateConfig = UtilizationRateConfig(coefficient, power);
        emit UtilizationRateConfigChanged(coefficient, power);
    }

    /// @dev Set base rate oracle for `pool` to `_baseRateOracle`
    function setBaseRateOracle(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle _baseRateOracle) external onlyOwner {
        baseRateOracle[pool] = _baseRateOracle;
        emit BaseRateOracleChanged(pool, _baseRateOracle);
    }

    /// @dev Set fixed term adjustment coefficient to `newCoefficient`
    function setFixedTermLoanAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        fixedTermLoanAdjustmentCoefficient = newCoefficient;
        emit FixedTermLoanAdjustmentCoefficientChanged(newCoefficient);
    }

    /**
     * @dev Set new borrow limit configuration
     * @param scoreFloor Minimum score
     * @param limitAdjustmentPower Adjust aggressiveness of curve (basis precision)
     * @param tvlLimitCoefficient Adjust for TVL (basis precision)
     * @param poolValueLimitCoefficient Adjust for pool value (basis precision)
     */
    function setBorrowLimitConfig(
        uint8 scoreFloor,
        uint16 limitAdjustmentPower,
        uint16 tvlLimitCoefficient,
        uint16 poolValueLimitCoefficient,
        uint16 ltvRatio,
        uint16 effectiveScorePower
    ) external onlyOwner {
        borrowLimitConfig = BorrowLimitConfig(
            scoreFloor,
            limitAdjustmentPower,
            tvlLimitCoefficient,
            poolValueLimitCoefficient,
            ltvRatio,
            effectiveScorePower
        );
        emit BorrowLimitConfigChanged(
            scoreFloor,
            limitAdjustmentPower,
            tvlLimitCoefficient,
            poolValueLimitCoefficient,
            ltvRatio,
            effectiveScorePower
        );
    }

    /**
     * @dev Get rate after borrowing `amount` given a `pool` and borrower `score`
     * Rate returned is based on pool utilization and credit score after borrowing `amount`
     * @param pool TrueFiPool to get rate for
     * @param score Score to get rate for
     * @param afterAmountLent Amount borrower wishes to borrow
     * @return Interest rate for borrowing `amount` (basis precision)
     */
    function rate(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 afterAmountLent
    ) external override view returns (uint256) {
        return combinedRate(poolBasicRate(pool, afterAmountLent), creditScoreAdjustmentRate(score));
    }

    /**
     * @dev Get interest rate for `pool` adjusted for utilization after borrowing `afterAmountLent` amount
     * @param pool Pool to get rate for
     * @param afterAmountLent Requested amount to borrow
     * @return Interest rate for `pool` adjusted for utilization and `amount` borrowed
     */
    function poolBasicRate(ITrueFiPool2 pool, uint256 afterAmountLent) public override view returns (uint256) {
        return min(riskPremium.add(securedRate(pool)).add(utilizationAdjustmentRate(pool, afterAmountLent)), MAX_RATE_CAP);
    }

    /**
     * @dev Get secured rate for `pool` from a Rate Oracle
     * @param pool Pool to get secured rate for
     * @return Secured rate for `pool` as given by Oracle
     */
    function securedRate(ITrueFiPool2 pool) public override view returns (uint256) {
        return baseRateOracle[pool].getWeeklyAPY();
    }

    /**
     * @dev Helper function used by poke() to save gas by calculating partial terms of the total rate
     * @param partialRate risk premium + utilization adjustment rate
     * @param __creditScoreAdjustmentRate credit score adjustment
     * @return sum of addends capped by MAX_RATE_CAP
     */
    function combinedRate(uint256 partialRate, uint256 __creditScoreAdjustmentRate) public override pure returns (uint256) {
        return min(partialRate.add(__creditScoreAdjustmentRate), MAX_RATE_CAP);
    }

    /**
     * @dev Get rate adjustment based on credit score
     * @param score Score to get adjustment for
     * @return Rate adjustment for credit score capped at MAX_RATE_CAP
     */
    function creditScoreAdjustmentRate(uint8 score) public override view returns (uint256) {
        if (score == 0) {
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        uint256 coefficient = uint256(creditScoreRateConfig.coefficient);
        uint256 power = uint256(creditScoreRateConfig.power);
        return min(coefficient.mul(uint256(MAX_CREDIT_SCORE)**power).div(uint256(score)**power).sub(coefficient), MAX_RATE_CAP);
    }

    /**
     * @dev Get utilization adjustment rate based on `pool` utilization and `afterAmountLent` borrowed
     * @param pool Pool to get pro forma adjustment rate for
     * @return Utilization adjusted rate for `pool` after borrowing `amount`
     */
    function utilizationAdjustmentRate(ITrueFiPool2 pool, uint256 afterAmountLent) public override view returns (uint256) {
        uint256 liquidRatio = pool.liquidRatio(afterAmountLent);
        if (liquidRatio == 0) {
            // if utilization is at 100 %
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        uint256 coefficient = uint256(utilizationRateConfig.coefficient);
        uint256 power = uint256(utilizationRateConfig.power);
        return min(coefficient.mul(1e4**power).div(liquidRatio**power).sub(coefficient), MAX_RATE_CAP);
    }

    /**
     * @dev Get fixed term loan adjustment given `term`
     * stability_adjustment = (term / 30) * stability_adjustment_coefficient
     * @param term Term of loan
     * @return Rate adjustment based on loan term
     */
    function fixedTermLoanAdjustment(uint256 term) public override view returns (uint256) {
        return term.div(30 days).mul(fixedTermLoanAdjustmentCoefficient);
    }

    /**
     * @dev Get adjustment for borrow limit based on `score`
     * limit_adjustment = borrower_score < score_floor ? 0 : (borrower_score/MAX_CREDIT_SCORE)^limit_adjustment_power
     * @param score Score to get limit adjustment for
     * @return Borrow limit adjusted based on `score`
     */
    function borrowLimitAdjustment(uint8 score) public override view returns (uint256) {
        int128 f64x64Score = TrueFiFixed64x64.fromUInt(uint256(score));
        int128 f64x64LimitAdjustmentPower = TrueFiFixed64x64.fromUInt(uint256(borrowLimitConfig.limitAdjustmentPower));
        return ((f64x64Score / MAX_CREDIT_SCORE).fixed64x64Pow(f64x64LimitAdjustmentPower / BASIS_POINTS) * BASIS_POINTS).toUInt();
    }

    function conservativeCollateralValue(ITrueFiPool2 pool, uint256 stakedAmount) public view returns (uint256) {
        if (stakedAmount == 0) {
            return 0;
        }
        return pool.oracle().truToToken(stakedAmount).mul(borrowLimitConfig.ltvRatio).div(BASIS_POINTS);
    }

    function conservativeCollateralRatio(
        ITrueFiPool2 pool,
        uint256 stakedAmount,
        uint256 borrowedAmount
    ) public view returns (uint256) {
        if (borrowedAmount == 0) {
            return 0;
        }
        return min(conservativeCollateralValue(pool, stakedAmount).mul(BASIS_POINTS).div(borrowedAmount), BASIS_POINTS);
    }

    function effectiveScore(
        uint8 score,
        ITrueFiPool2 pool,
        uint256 stakedAmount,
        uint256 borrowedAmount
    ) public view returns (uint8) {
        uint16 effectiveScorePower = borrowLimitConfig.effectiveScorePower;
        uint256 creditScoreAdjustment = uint256(MAX_CREDIT_SCORE - score)
            .mul(conservativeCollateralRatio(pool, stakedAmount, borrowedAmount)**effectiveScorePower)
            .div(uint256(BASIS_POINTS)**effectiveScorePower);
        uint256 _effectiveScore = min(creditScoreAdjustment.add(score), MAX_CREDIT_SCORE);
        return uint8(_effectiveScore);
    }

    /**
     * @dev Get borrow limit in USD with 18 decimal precision
     * @param pool Pool which is being borrowed from
     * @param score Borrower score
     * @param maxBorrowerLimit Borrower maximum borrow limit, 18 dec precision
     * @param totalBorrowedInUsd Total amount borrowed from all pools, 18 dec precision
     * @return Borrow limit
     */
    function borrowLimit(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 maxBorrowerLimit,
        uint256 stakedCollateralInTru,
        uint256 totalBorrowedInUsd
    ) public override view returns (uint256) {
        if (score < borrowLimitConfig.scoreFloor) {
            return 0;
        }
        return saturatingSub(poolBorrowMax(pool, score, maxBorrowerLimit, stakedCollateralInTru), totalBorrowedInUsd);
    }

    function isOverLimit(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 maxBorrowerLimit,
        uint256 stakedCollateralInTru,
        uint256 totalBorrowedInUsd
    ) public override view returns (bool) {
        return poolBorrowMax(pool, score, maxBorrowerLimit, stakedCollateralInTru) < totalBorrowedInUsd;
    }

    function poolBorrowMax(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 maxBorrowerLimit,
        uint256 stakedCollateralInTru
    ) internal view returns (uint256) {
        uint256 maxTVLLimit = poolFactory.supportedPoolsTVL().mul(borrowLimitConfig.tvlLimitCoefficient).div(BASIS_POINTS);
        uint256 adjustment = borrowLimitAdjustment(score);
        uint256 collateralValue = conservativeCollateralValue(pool, stakedCollateralInTru);
        uint256 adjustedBorrowerLimit = maxBorrowerLimit.mul(adjustment).div(BASIS_POINTS).add(collateralValue);
        uint256 adjustedTVLLimit = maxTVLLimit.mul(adjustment).div(BASIS_POINTS);
        uint256 creditLimit = min(adjustedBorrowerLimit, adjustedTVLLimit);
        uint256 poolValueInUsd = pool.oracle().tokenToUsd(pool.poolValue());
        return min(poolValueInUsd.mul(borrowLimitConfig.poolValueLimitCoefficient).div(BASIS_POINTS), creditLimit);
    }

    /// @dev Internal helper to calculate saturating sub of `a` - `b`
    function saturatingSub(uint256 a, uint256 b) internal pure returns (uint256) {
        if (b > a) {
            return 0;
        }
        return a.sub(b);
    }

    /// @dev Internal helper to calculate minimum of `a` and `b`
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }
}
