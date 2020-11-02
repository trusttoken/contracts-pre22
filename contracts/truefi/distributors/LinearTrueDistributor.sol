// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ITrueDistributor, IERC20} from "../interface/ITrueDistributor.sol";
import {Ownable} from "../upgradeability/UpgradeableOwnable.sol";

/**
 * @title LinearTrueDistributor
 * @notice Distribute TRU in a linear manner
 */
contract LinearTrueDistributor is ITrueDistributor, Ownable {
    using SafeMath for uint256;

    IERC20 public override trustToken;
    uint256 public distributionStart;
    uint256 public duration;
    uint256 public totalAmount;
    uint256 public lastDistribution;
    uint256 public distributed;

    address public farm;

    event FarmChanged(address newFarm);
    event Distributed(address newFarm);

    function initialize(
        uint256 _distributionStart,
        uint256 _duration,
        uint256 _amount,
        IERC20 _trustToken
    ) public initializer {
        Ownable.initialize();
        distributionStart = _distributionStart;
        lastDistribution = _distributionStart;
        duration = _duration;
        totalAmount = _amount;
        trustToken = _trustToken;
    }

    function setFarm(address newFarm) external onlyOwner {
        farm = newFarm;
        FarmChanged(newFarm);
    }

    function distribute(address) public override {
        if (block.timestamp < distributionStart) {
            return;
        }

        uint256 amount = totalAmount.sub(distributed);
        if (block.timestamp < distributionStart.add(duration)) {
            amount = block.timestamp.sub(lastDistribution).mul(totalAmount).div(duration);
        }

        lastDistribution = block.timestamp;
        if (amount == 0) {
            return;
        }
        distributed = distributed.add(amount);

        require(trustToken.transfer(farm, amount));
    }

    function withdraw(uint256 _amount) public override onlyOwner {
        distributed = distributed.add(_amount);
        require(trustToken.transfer(msg.sender, _amount));
    }
}
