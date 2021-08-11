// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract CreditLineRate is UpgradeableClaimable {
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

    event RiskPremiumChanged(uint256 newRate);

    event CreditAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentCoefficientChanged(uint256 newCoefficient);

    event UtilizationAdjustmentPowerChanged(uint256 newValue);

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

    function rate(ITrueFiPool2 pool, uint8 score) external view returns (uint256) {
        return combinedRate(poolBasicRate(pool), creditScoreAdjustmentRate(score));
    }

    function poolBasicRate(ITrueFiPool2 pool) public view returns (uint256) {
        return riskPremium.add(utilizationAdjustmentRate(pool));
    }

    /**
     * @dev Helper function used by poke() to save gas by calculating partial terms of the total rate
     * @param partialRate risk premium + utilization adjustment rate
     * @param __creditScoreAdjustmentRate credit score adjustment
     * @return sum of addends capped by MAX_RATE_CAP
     */
    function combinedRate(uint256 partialRate, uint256 __creditScoreAdjustmentRate) public pure returns (uint256) {
        return min(partialRate.add(__creditScoreAdjustmentRate), MAX_RATE_CAP);
    }

    function creditScoreAdjustmentRate(uint8 score) public view returns (uint256) {
        if (score == 0) {
            return MAX_RATE_CAP; // Cap rate by 500%
        }
        return min(creditAdjustmentCoefficient.mul(MAX_CREDIT_SCORE - score).div(score), MAX_RATE_CAP);
    }

    function utilizationAdjustmentRate(ITrueFiPool2 pool) public view returns (uint256) {
        uint256 liquidRatio = pool.liquidRatio();
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
