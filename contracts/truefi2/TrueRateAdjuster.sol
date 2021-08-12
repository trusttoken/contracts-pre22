// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITimeAveragedBaseRateOracle} from "./interface/ITimeAveragedBaseRateOracle.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";

contract TrueRateAdjuster is ITrueRateAdjuster, UpgradeableClaimable {
    using SafeMath for uint256;

    uint256 constant MAX_RATE_CAP = 50000;
    uint8 constant MAX_CREDIT_SCORE = 255;

    // basis precision: 10000 = 100%
    uint256 public utilizationAdjustmentCoefficient;

    uint256 public utilizationAdjustmentPower;

    // basis precision: 10000 = 100%
    uint256 public creditAdjustmentCoefficient;

    // basis precision: 10000 = 100%
    uint256 public riskPremium;

    mapping(ITrueFiPool2 => ITimeAveragedBaseRateOracle) public baseRateOracle;

    event RiskPremiumChanged(uint256 newRate);

    event CreditAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentPowerChanged(uint256 newValue);

    event BaseRateOracleChanged(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle oracle);

    constructor(uint256 _riskPremium) public {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = _riskPremium;
        creditAdjustmentCoefficient = 1000;
        utilizationAdjustmentCoefficient = 50;
        utilizationAdjustmentPower = 2;
    }

    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        emit RiskPremiumChanged(newRate);
    }

    function setCreditAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        creditAdjustmentCoefficient = newCoefficient;
        emit CreditAdjustmentCoefficientChanged(newCoefficient);
    }

    function setUtilizationAdjustmentCoefficient(uint256 newCoefficient) external onlyOwner {
        utilizationAdjustmentCoefficient = newCoefficient;
        emit UtilizationAdjustmentCoefficientChanged(newCoefficient);
    }

    function setUtilizationAdjustmentPower(uint256 newValue) external onlyOwner {
        utilizationAdjustmentPower = newValue;
        emit UtilizationAdjustmentPowerChanged(newValue);
    }

    function setBaseRateOracle(ITrueFiPool2 pool, ITimeAveragedBaseRateOracle _baseRateOracle) external onlyOwner {
        baseRateOracle[pool] = _baseRateOracle;
        emit BaseRateOracleChanged(pool, _baseRateOracle);
    }

    function rate(ITrueFiPool2 pool, uint8 score) external override view returns (uint256) {
        return combinedRate(poolBasicRate(pool), creditScoreAdjustmentRate(score));
    }

    function proFormaRate(
        ITrueFiPool2 pool,
        uint8 score,
        uint256 amount
    ) external override view returns (uint256) {
        return combinedRate(proFormaPoolBasicRate(pool, amount), creditScoreAdjustmentRate(score));
    }

    function poolBasicRate(ITrueFiPool2 pool) public override view returns (uint256) {
        return _poolBasicRate(pool, utilizationAdjustmentRate(pool));
    }

    function proFormaPoolBasicRate(ITrueFiPool2 pool, uint256 amount) public view returns (uint256) {
        return _poolBasicRate(pool, proFormaUtilizationAdjustmentRate(pool, amount));
    }

    function _poolBasicRate(ITrueFiPool2 pool, uint256 _utilizationAdjustmentRate) internal view returns (uint256) {
        return min(riskPremium.add(securedRate(pool)).add(_utilizationAdjustmentRate), MAX_RATE_CAP);
    }

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

    function creditScoreAdjustmentRate(uint8 score) public override view returns (uint256) {
        if (score == 0) {
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        return min(creditAdjustmentCoefficient.mul(MAX_CREDIT_SCORE - score).div(score), MAX_RATE_CAP);
    }

    function utilizationAdjustmentRate(ITrueFiPool2 pool) public override view returns (uint256) {
        return _utilizationAdjustmentRate(pool.liquidRatio());
    }

    function proFormaUtilizationAdjustmentRate(ITrueFiPool2 pool, uint256 amount) public view returns (uint256) {
        return _utilizationAdjustmentRate(pool.proFormaLiquidRatio(amount));
    }

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

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }
}
