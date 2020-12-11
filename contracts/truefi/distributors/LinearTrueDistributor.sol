// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Ownable} from "../common/UpgradeableOwnable.sol";
import {ITrueDistributor, IERC20} from "../interface/ITrueDistributor.sol";

/**
 * @title LinearTrueDistributor
 * @notice Distribute TRU in a linear fashion
 * @dev Distributor contract which uses a linear distribution
 *
 * Contracts are registered to receive distributions. Once registered,
 * a farm contract can claim TRU from the distributor.
 * - Distributions are based on time.
 * - Owner can withdraw funds in case distribution need to be re-allocated
 */
contract LinearTrueDistributor is ITrueDistributor, Ownable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public override trustToken;
    uint256 public distributionStart;
    uint256 public duration;
    uint256 public totalAmount;
    uint256 public lastDistribution;
    uint256 public distributed;

    // contract which claim tokens from distributor
    address public override farm;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when the farm address is changed
     * @param newFarm new farm contract
     */
    event FarmChanged(address newFarm);

    /**
     * @dev Emitted when the total distributed amount is changed
     * @param newTotalAmount new totalAmount value
     */
    event TotalAmountChanged(uint256 newTotalAmount);

    /**
     * @dev Emitted when a distribution occurs
     * @param amount Amount of TRU distributed to farm
     */
    event Distributed(uint256 amount);

    /**
     * @dev Initialize distributor
     * @param _distributionStart Start time for distribution
     * @param _duration Length of distribution
     * @param _amount Amount to distribute
     * @param _trustToken TRU address
     */
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

    /**
     * @dev Set contract to receive distributions
     * Will distribute to previous contract if farm already exists
     * @param newFarm New farm for distribution
     */
    function setFarm(address newFarm) external onlyOwner {
        distribute();
        farm = newFarm;
        emit FarmChanged(newFarm);
    }

    /**
     * @dev Distribute tokens to farm in linear fashion based on time
     */
    function distribute() public override {
        // cannot distribute until distribution start
        uint256 amount = nextDistribution();

        if (amount == 0) {
            return;
        }

        // transfer tokens & update state
        lastDistribution = block.timestamp;
        distributed = distributed.add(amount);
        require(trustToken.transfer(farm, amount));

        emit Distributed(amount);
    }

    /**
     * @dev Calculate next distribution amount
     * @return amount of tokens for next distribution
     */
    function nextDistribution() public override view returns (uint256) {
        // return 0 if before distribution or farm is not set
        if (block.timestamp < distributionStart || farm == address(0)) {
            return 0;
        }

        // calculate distribution amount
        uint256 amount = totalAmount.sub(distributed);
        if (block.timestamp < distributionStart.add(duration)) {
            amount = block.timestamp.sub(lastDistribution).mul(totalAmount).div(duration);
        }
        return amount;
    }

    /**
     * @dev Withdraw funds (for instance if owner decides to create a new distribution)
     * Distributes remaining funds before withdrawing
     * Ends current distribution
     */
    function empty() public override onlyOwner {
        distribute();
        distributed = 0;
        totalAmount = 0;
        require(trustToken.transfer(msg.sender, trustToken.balanceOf(address(this))));
    }

    /**
     * @dev Change amount of tokens distributed daily by changing total distributed amount
     */
    function setDailyDistribution(uint256 dailyDistribution) public onlyOwner {
        distribute();
        uint256 timeLeft = distributionStart.add(duration).sub(block.timestamp);
        if (timeLeft > duration) {
            timeLeft = duration;
        } else {
            distributionStart = block.timestamp;
            duration = timeLeft;
        }
        totalAmount = dailyDistribution.mul(timeLeft).div(1 days);
        distributed = 0;
        emit TotalAmountChanged(totalAmount);
    }
}
