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
    address public farm;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when the farm address is changed
     * @param newFarm new farm contract
     */
    event FarmChanged(address newFarm);

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
     * @param newFarm New farm for distribution
     */
    function setFarm(address newFarm) external onlyOwner {
        farm = newFarm;
        FarmChanged(newFarm);
    }

    /**
     * @dev Distribute tokens to farm in linear fashion based on time
     */
    function distribute(address) public override {
        // cannot distribute until distribution start
        if (block.timestamp < distributionStart) {
            return;
        }
        // calculate distribution amount
        uint256 amount = totalAmount.sub(distributed);
        if (block.timestamp < distributionStart.add(duration)) {
            amount = block.timestamp.sub(lastDistribution).mul(totalAmount).div(duration);
        }
        // store last distribution
        lastDistribution = block.timestamp;
        if (amount == 0) {
            return;
        }
        // transfer tokens & update distributed amount
        distributed = distributed.add(amount);
        require(trustToken.transfer(farm, amount));

        emit Distributed(amount);
    }

    /**
     * @dev Withdraw funds (for instance if owner decides to create a new distribution)
     */
    function empty() public override onlyOwner {
        require(trustToken.transfer(msg.sender, trustToken.balanceOf(address(this))));
    }
}
