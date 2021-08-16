// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITimeAveragedBaseRateOracle} from "./interface/ITimeAveragedBaseRateOracle.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";
import {TrueFiFixed64x64} from "./libraries/TrueFiFixed64x64.sol";

interface ITrueFiPool2WithDecimals is ITrueFiPool2 {
    function decimals() external view returns (uint8);
}

/**
 * @title TrueFi Rate Adjuster
 * @dev Rate Adjuster for interest rates in the TrueFi Protocol
 * https://github.com/trusttoken/truefi-spec/blob/master/TrueFi2.0.md#lines-of-credit
 *
 * - Extracts interest rate calculations into a separate contract
 * - Calculates interest rates for Lines of Credit and Term Loans
 * - Calculates borrow limits for Lines of Credit and Term Loans
 * - Includes some adjustable parameters for changing models
 */
contract TrueRateAdjuster is ITrueRateAdjuster, UpgradeableClaimable {
    using SafeMath for uint256;
    using TrueFiFixed64x64 for int128;

    /// @dev basis precision: 10000 = 100%
    /// @dev maximum interest rate in basis points
    uint256 constant MAX_RATE_CAP = 50000;

    /// @dev credit score is stored as uint(8)
    uint8 constant MAX_CREDIT_SCORE = 255;

    struct CreditScoreRateConfig {
        uint16 coefficient;
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
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    /// @dev proportional coefficient to control effect of utilization on score (basis precision)
    uint256 public utilizationAdjustmentCoefficient;

    /// @dev power factor to control affect of utilization on score (basis precision)
    uint256 public utilizationAdjustmentPower;

    CreditScoreRateConfig public creditScoreRateConfig;

    // @dev premium rate for uncollateralized landing (basis precision)
    uint256 public riskPremium;

    /// @dev interest rate adjustment per each 30 days for term loans (basis precision)
    uint256 public fixedTermLoanAdjustmentCoefficient;

    /// @dev Base rate oracles stored for each pool
    mapping(ITrueFiPool2 => ITimeAveragedBaseRateOracle) public baseRateOracle;

    /// @dev store borrow limit configuration
    BorrowLimitConfig public borrowLimitConfig;

    // ======= STORAGE DECLARATION END ============

    /// @dev Emit `newRate` when risk premium changed
    event RiskPremiumChanged(uint256 newRate);

    /// @dev Emit `newCoefficient` when credit adjustment coefficient changed
    event CreditScoreRateConfigChanged(uint16 coefficient, uint16 power);

    /// @dev Emit `newCoefficient` when utilization adjustment coefficient changed
    event UtilizationAdjustmentCoefficientChanged(uint256 newCoefficient);

    /// @dev Emit `newValue` when utilization adjustment power changed
    event UtilizationAdjustmentPowerChanged(uint256 newValue);

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
        uint16 poolValueLimitCoefficient
    );

    /// @dev initializer
    function initialize() public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = 200;
        creditScoreRateConfig = CreditScoreRateConfig(1000, 1);
        utilizationAdjustmentCoefficient = 50;
        utilizationAdjustmentPower = 2;
        fixedTermLoanAdjustmentCoefficient = 25;
        borrowLimitConfig = BorrowLimitConfig(40, 7500, 1500, 1500);
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

    /// @dev Set utilization adjustment coefficient to `newCoefficient`
    function setUtilizationAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        utilizationAdjustmentCoefficient = newCoefficient;
        emit UtilizationAdjustmentCoefficientChanged(newCoefficient);
    }

    /// @dev Set utilization adjustment power to `newValue`
    function setUtilizationAdjustmentPower(uint256 newValue) external onlyOwner {
        utilizationAdjustmentPower = newValue;
        emit UtilizationAdjustmentPowerChanged(newValue);
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
        uint16 poolValueLimitCoefficient
    ) external onlyOwner {
        borrowLimitConfig = BorrowLimitConfig(scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient);
        emit BorrowLimitConfigChanged(scoreFloor, limitAdjustmentPower, tvlLimitCoefficient, poolValueLimitCoefficient);
    }

    /**
     * @dev Get rate given a `pool` and borrower `score`
     * Rate returned is based on pool utilization and credit score
     * @param pool TrueFiPool to get rate for
     * @param score Score to get rate for
     * @return Interest rate for borrower (basis precision)
     */
    function rate(ITrueFiPool2 pool, uint8 score) external override view returns (uint256) {
        return combinedRate(poolBasicRate(pool), creditScoreAdjustmentRate(score));
    }

    /**
     * @dev Get rate after borrowing `amount` given a `pool` and borrower `score`
     * Rate returned is based on pool utilization and credit score after borrowing `amount`
     * @param pool TrueFiPool to get rate for
     * @param score Score to get rate for
     * @param amount Amount borrower wishes to borrow
     * @return Interest rate for borrowing `amount` (basis precision)
     */
    function proFormaRate(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 amount
    ) external override view returns (uint256) {
        return combinedRate(proFormaPoolBasicRate(pool, amount), creditScoreAdjustmentRate(score));
    }

    /**
     * @dev Get interest rate for `pool` adjusted for utilization
     * @param pool Pool to get rate for
     * @return Interest rate for `pool` adjusted for utilization
     */
    function poolBasicRate(ITrueFiPool2 pool) public override view returns (uint256) {
        return _poolBasicRate(pool, utilizationAdjustmentRate(pool));
    }

    /**
     * @dev Get interest rate for `pool` adjusted for utilization after borrowing `amount`
     * @param pool Pool to get rate for
     * @param amount Requested amount to borrow
     * @return Interest rate for `pool` adjusted for utilization and `amount` borrowed
     */
    function proFormaPoolBasicRate(ITrueFiPool2 pool, uint256 amount) public view returns (uint256) {
        return _poolBasicRate(pool, proFormaUtilizationAdjustmentRate(pool, amount));
    }

    /**
     * @dev Internal function to get basic rate given a `pool` and `_utilizationAdjustmentRate`
     * basic_rate = min(risk_premium + secured_rate + utilization_adjusted_rate, max_rate)
     */
    function _poolBasicRate(ITrueFiPool2 pool, uint256 _utilizationAdjustmentRate) internal view returns (uint256) {
        return min(riskPremium.add(securedRate(pool)).add(_utilizationAdjustmentRate), MAX_RATE_CAP);
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
        return min(coefficient.mul(MAX_CREDIT_SCORE**power).div(score**power).sub(coefficient), MAX_RATE_CAP);
    }

    /**
     * @dev Get utilization adjustment rate based on `pool` utilization
     * @param pool Pool to get adjustment rate for
     * @return Utilization adjusted rate for `pool`
     */
    function utilizationAdjustmentRate(ITrueFiPool2 pool) public override view returns (uint256) {
        return _utilizationAdjustmentRate(pool.liquidRatio());
    }

    /**
     * @dev Get utilization adjustment rate based on `pool` utilization and `amount` borrowed
     * @param pool Pool to get pro forma adjustment rate for
     * @return Utilization adjusted rate for `pool` after borrowing `amount`
     */
    function proFormaUtilizationAdjustmentRate(ITrueFiPool2 pool, uint256 amount) public view returns (uint256) {
        return _utilizationAdjustmentRate(pool.proFormaLiquidRatio(amount));
    }

    /**
     * @dev Internal function to calculate utilization adjusted rate given a `liquidRatio`
     * utilization_adjustment = utilization_adjustment_coefficient * (1/(pool_liquid_ratio)^utilization_adjustment_power - 1)
     */
    function _utilizationAdjustmentRate(uint256 liquidRatio) internal view returns (uint256) {
        if (liquidRatio == 0) {
            // if utilization is at 100 %
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        return
            min(
                utilizationAdjustmentCoefficient.mul(1e4**utilizationAdjustmentPower).div(liquidRatio**utilizationAdjustmentPower).sub(
                    utilizationAdjustmentCoefficient
                ),
                MAX_RATE_CAP
            );
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
        return ((f64x64Score / MAX_CREDIT_SCORE).fixed64x64Pow(f64x64LimitAdjustmentPower / 10000) * 10000).toUInt();
    }

    /**
     * @dev Get borrow limit
     * @param pool Pool which is being borrowed from
     * @param score Borrower score
     * @param maxBorrowerLimit Borrower maximum borrow limit
     * @param totalTVL TVL of all pools
     * @param totalBorrowed Total amount borrowed from all pools
     * @return Borrow limit
     */
    function borrowLimit(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 maxBorrowerLimit,
        uint256 totalTVL,
        uint256 totalBorrowed
    ) public override view returns (uint256) {
        if (score < borrowLimitConfig.scoreFloor) {
            return 0;
        }
        uint8 poolDecimals = ITrueFiPool2WithDecimals(address(pool)).decimals();
        maxBorrowerLimit = maxBorrowerLimit.mul(uint256(10)**poolDecimals).div(1 ether);
        uint256 maxTVLLimit = totalTVL.mul(borrowLimitConfig.tvlLimitCoefficient).div(10000);
        uint256 adjustment = borrowLimitAdjustment(score);
        uint256 creditLimit = min(maxBorrowerLimit, maxTVLLimit).mul(adjustment).div(10000);
        uint256 poolBorrowMax = min(pool.poolValue().mul(borrowLimitConfig.poolValueLimitCoefficient).div(10000), creditLimit);
        return saturatingSub(poolBorrowMax, totalBorrowed);
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
