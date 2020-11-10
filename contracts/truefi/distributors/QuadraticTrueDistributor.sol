// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Ownable} from "../common/UpgradeableOwnable.sol";
import {ITrueDistributor} from "../interface/ITrueDistributor.sol";

/**
 * @title TrueDistributor
 * @notice Distributes TRU to TrueFarm farms
 * @dev This contract distributes trustTokens starting from `startingBlock` for the next 10 million block (roughly 4.5 years)
 * The tokens will be distributed according to the declining quadratic curve
 * For each block `DISTRIBUTION_FACTOR*(10M-n)^2` TRU is awarded where `n` if a block number since `startingBlock`
 * `DISTRIBUTION_FACTOR` has been selected so that 536,500,000 (39% of total TRU supply) will be awarded in total
 */
contract QuadraticTrueDistributor is ITrueDistributor, Ownable {
    using SafeMath for uint256;

    struct Farm {
        uint256 shares;
        uint256 lastDistributionBlock;
    }

    uint256 public constant PRECISION = 1e33;
    uint256 public constant TOTAL_SHARES = 1e7;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public override trustToken;
    uint256 public startingBlock;
    uint256 public lastBlock;
    mapping(address => Farm) public farms;

    // ======= STORAGE DECLARATION END ============

    function getDistributionFactor() public virtual pure returns (uint256) {
        return 26824995976250469437449703116;
    }

    function getTotalBlocks() public virtual pure returns (uint256) {
        return 1e7;
    }

    function initialize(uint256 _startingBlock, IERC20 _trustToken) public initializer {
        Ownable.initialize();
        startingBlock = _startingBlock;
        lastBlock = startingBlock.add(getTotalBlocks());
        trustToken = _trustToken;
        farms[msg.sender].shares = TOTAL_SHARES;
    }

    /**
     * @notice transfer all rewards since previous `distribute` call to the `farm`.
     * Transferred reward is proportional to the stake of the farm
     */
    function distribute(address farm) public override {
        uint256 currentBlock = block.number;
        uint256 totalRewardForInterval = reward(farms[farm].lastDistributionBlock, currentBlock);

        farms[farm].lastDistributionBlock = currentBlock;

        uint256 farmsReward = totalRewardForInterval.mul(farms[farm].shares).div(TOTAL_SHARES);

        if (farmsReward == 0) {
            return;
        }

        require(trustToken.transfer(farm, normalise(farmsReward)));
    }

    function empty() public override onlyOwner {
        require(trustToken.transfer(msg.sender, trustToken.balanceOf(address(this))));
    }

    function normalise(uint256 amount) public pure returns (uint256) {
        return amount.div(PRECISION);
    }

    function transfer(
        address fromFarm,
        address toFarm,
        uint256 sharesAmount
    ) external onlyOwner {
        distribute(fromFarm);
        distribute(toFarm);
        farms[fromFarm].shares = farms[fromFarm].shares.sub(sharesAmount);
        farms[toFarm].shares = farms[toFarm].shares.add(sharesAmount);
    }

    function getShares(address farm) external view returns (uint256) {
        return farms[farm].shares;
    }

    function getLastDistributionBlock(address farm) external view returns (uint256) {
        return farms[farm].lastDistributionBlock;
    }

    function adjustInterval(uint256 fromBlock, uint256 toBlock) internal view returns (uint256, uint256) {
        if (fromBlock < startingBlock) {
            fromBlock = startingBlock;
        }
        if (toBlock > lastBlock) {
            toBlock = lastBlock;
        }
        return (fromBlock, toBlock);
    }

    /**
     * @notice Reward from `fromBlock` to `toBlock`.
     */
    function reward(uint256 fromBlock, uint256 toBlock) public view returns (uint256) {
        require(fromBlock <= toBlock, "QuadraticTrueDistributor: Cannot pass an invalid interval");
        if (toBlock < startingBlock || fromBlock > lastBlock || fromBlock == toBlock) {
            return 0;
        }
        (uint256 adjustedFromBlock, uint256 adjustedToBlock) = adjustInterval(fromBlock, toBlock);
        return rewardFormula(adjustedFromBlock.sub(startingBlock), adjustedToBlock.sub(startingBlock));
    }

    /**
     * @dev Calculates sum of rewards from `fromBlock` to `toBlock`.
     * Uses the fact that sum of n first squares is calculated by n(n+1)(2n+1)/6
     * @param fromBlock Start Block
     * @param toBlock End block
     * @return Reward for block range
     */
    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal virtual pure returns (uint256) {
        return
            squareSumTimes6(getTotalBlocks().sub(fromBlock)).sub(squareSumTimes6(getTotalBlocks().sub(toBlock))).mul(
                getDistributionFactor()
            );
    }

    /**
     * @dev Calculate square sum * 6 to find area under the curve
     * @return square sum times 6 of n
     */
    function squareSumTimes6(uint256 n) internal pure returns (uint256) {
        return n.mul(n.add(1)).mul(n.mul(2).add(1));
    }
}
