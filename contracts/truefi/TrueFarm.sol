// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITrueDistributor} from "./interface/ITrueDistributor.sol";
import {ITrueFarm} from "./interface/ITrueFarm.sol";
import {Initializable} from "./upgradeability/Initializable.sol";

/**
 * @title TrueFarm
 * @notice Deposit liquidity tokens to earn TRU rewards over time
 * @dev Staking pool where tokens are staked for TRU rewards
 * A Distributor contract decides how much TRU a farm can earn over time
 */
contract TrueFarm is ITrueFarm, Initializable {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;

    IERC20 public override stakingToken;
    IERC20 public override trustToken;
    ITrueDistributor public override trueDistributor;
    string public override name;

    uint256 public override totalStaked;
    mapping(address => uint256) public staked;

    uint256 public cumulativeRewardPerToken;
    mapping(address => uint256) public previousCumulatedRewardPerToken;
    mapping(address => uint256) public claimableReward;

    uint256 public totalClaimedRewards;
    uint256 public totalFarmRewards;

    /**
     * @dev Initalize staking pool with a Distributor contraxct
     * The distributor contract calculates how much TRU rewards this contract
     * gets, and stores TRU for distribution.
     * @param _stakingToken
     * @param _trueDistributor
     * @param _name
     */
    function initialize(
        IERC20 _stakingToken,
        ITrueDistributor _trueDistributor,
        string memory _name
    ) public initializer {
        stakingToken = _stakingToken;
        trueDistributor = _trueDistributor;
        trustToken = _trueDistributor.trustToken();
        name = _name;
    }

    /**
     * @dev Stake tokens for TRU rewards.
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external override update {
        staked[msg.sender] = staked[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
    }

    /**
     * @dev Remove staked tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external override update {
        require(amount <= staked[msg.sender], "TrueFarm: Cannot withdraw amount bigger than available balance");
        staked[msg.sender] = staked[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        require(stakingToken.transfer(msg.sender, amount));
    }

    /**
     * @dev Claim TRU Rewards
     */
    function claim() external override update {
        totalClaimedRewards = totalClaimedRewards.add(claimableReward[msg.sender]);
        uint256 rewardToClaim = claimableReward[msg.sender];
        claimableReward[msg.sender] = 0;
        require(trustToken.transfer(msg.sender, rewardToClaim));
    }

    /**
     * @dev Update state and get TRU from distributor
     */
    modifier update() {
        trueDistributor.distribute(address(this));
        uint256 newTotalFarmRewards = trustToken.balanceOf(address(this)).add(totalClaimedRewards).mul(PRECISION);
        uint256 totalBlockReward = newTotalFarmRewards.sub(totalFarmRewards);
        totalFarmRewards = newTotalFarmRewards;
        if (totalStaked > 0) {
            cumulativeRewardPerToken = cumulativeRewardPerToken.add(totalBlockReward.div(totalStaked));
        }
        claimableReward[msg.sender] = claimableReward[msg.sender].add(
            staked[msg.sender].mul(cumulativeRewardPerToken.sub(previousCumulatedRewardPerToken[msg.sender])).div(PRECISION)
        );
        previousCumulatedRewardPerToken[msg.sender] = cumulativeRewardPerToken;
        _;
    }
}
