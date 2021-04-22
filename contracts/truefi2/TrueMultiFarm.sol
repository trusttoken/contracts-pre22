// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Initializable} from "../common/Initializable.sol";
import {ITrueDistributor} from "../truefi/interface/ITrueDistributor.sol";
import {ITrueMultiFarm} from "./interface/ITrueMultiFarm.sol";

/**
 * @title TrueMultiFarm
 * @notice Deposit liquidity tokens to earn TRU rewards over time
 * @dev Staking pool where tokens are staked for TRU rewards
 * A Distributor contract decides how much TRU a farm can earn over time
 */
contract TrueMultiFarm is ITrueMultiFarm, Initializable {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;

    struct Stakes {
        uint256 totalStaked;
        mapping(address => uint256) staked;
    }

    struct FarmRewards {
        // track overall cumulative rewards
        uint256 cumulativeRewardPerToken;
        // track previous cumulate rewards for accounts
        mapping(address => uint256) previousCumulatedRewardPerToken;
        // track claimable rewards for accounts
        mapping(address => uint256) claimableReward;
        // track total rewards
        uint256 totalClaimedRewards;
        uint256 totalFarmRewards;
    }


    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public trustToken;
    ITrueDistributor public override trueDistributor;

    // address(this) = multistake
    mapping(address => Stakes) public stakes; 
    mapping(address => FarmRewards) public rewards; 

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when an account stakes
     * @param who Account staking
     * @param amountStaked Amount of tokens staked
     */
    event Stake(address indexed token, address indexed who, uint256 amountStaked);

    /**
     * @dev Emitted when an account unstakes
     * @param who Account unstaking
     * @param amountUnstaked Amount of tokens unstaked
     */
    event Unstake(address indexed token, address indexed who, uint256 amountUnstaked);

    /**
     * @dev Emitted when an account claims TRU rewards
     * @param who Account claiming
     * @param amountClaimed Amount of TRU claimed
     */
    event Claim(address indexed token, address indexed who, uint256 amountClaimed);

    /**
     * @dev Initialize staking pool with a Distributor contract
     * The distributor contract calculates how much TRU rewards this contract
     * gets, and stores TRU for distribution.
     * @param _trueDistributor Distributor contract
     */
    function initialize(
        ITrueDistributor _trueDistributor
    ) public initializer {
        trueDistributor = _trueDistributor;
        trustToken = _trueDistributor.trustToken();
        require(trueDistributor.farm() == address(this), "TrueMultiFarm: Distributor farm is not set");
    }

    modifier hasShares(address token) {
        require(stakes[address(this)].staked[token] > 0, "TrueMultiFarm: This token has no shares");
        _;
    }

    /**
     * @dev Stake tokens for TRU rewards.
     * Also claims any existing rewards.
     * @param amount Amount of tokens to stake
     */
    function stake(address token, uint256 amount) external override hasShares(token) update(token) {
        if (rewards[token].claimableReward[msg.sender] > 0) {
            _claim(token);
        }
        stakes[token].staked[msg.sender] = stakes[token].staked[msg.sender].add(amount);
        stakes[token].totalStaked = stakes[token].totalStaked.add(amount);
        require(IERC20(token).transferFrom(msg.sender, address(this), amount));
        emit Stake(token, msg.sender, amount);
    }

    /**
     * @dev Internal unstake function
     * @param amount Amount of tokens to unstake
     */
    function _unstake(address token, uint256 amount) internal {
        require(amount <= stakes[token].staked[msg.sender], "TrueMultiFarm: Cannot withdraw amount bigger than available balance");
        stakes[token].staked[msg.sender] = stakes[token].staked[msg.sender].sub(amount);
        stakes[token].totalStaked = stakes[token].totalStaked.sub(amount);
        require(IERC20(token).transfer(msg.sender, amount));
        emit Unstake(token, msg.sender, amount);
    }

    /**
     * @dev Internal claim function
     */
    function _claim(address token) internal {
        uint256 rewardToClaim = rewards[token].claimableReward[msg.sender];
        rewards[token].totalClaimedRewards = rewards[token].totalClaimedRewards.add(rewardToClaim);
        rewards[token].claimableReward[msg.sender] = 0;
        rewards[address(this)].claimableReward[token] = rewards[address(this)].claimableReward[token].sub(rewardToClaim);
        require(trustToken.transfer(msg.sender, rewardToClaim));
        emit Claim(token, msg.sender, rewardToClaim);
    }

    /**
     * @dev Remove staked tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(address token, uint256 amount) external override update(token) {
        _unstake(token, amount);
    }

    /**
     * @dev Claim TRU rewards
     */
    function claim(address[] calldata tokens) external override {
        _distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateRewardsForToken(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            _claim(tokens[i]);
        }
    }

    /**
     * @dev Unstake amount and claim rewards
     */
    function exit(address[] calldata tokens) external override {
        _distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateRewardsForToken(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            _unstake(tokens[i], stakes[tokens[i]].staked[msg.sender]);
            _claim(tokens[i]);
        }
    }

    function setShares(address[] calldata tokens, uint256[] calldata shares) public {
        require(tokens.length == shares.length);
        _distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateShares(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 oldStaked = stakes[address(this)].staked[msg.sender];
            stakes[address(this)].staked[msg.sender] = shares[i];
            stakes[address(this)].totalStaked = stakes[address(this)].totalStaked.sub(oldStaked).add(shares[i]);
        }
    }

    // function claimable(address account) external view returns (uint256) {
    //     if (staked[account] == 0) {
    //         return claimableReward[account];
    //     }
    //     // estimate pending reward from distributor
    //     uint256 pending = trueDistributor.nextDistribution();
    //     // calculate total rewards (including pending)
    //     uint256 newTotalFarmRewards = trustToken.balanceOf(address(this)).add(pending).add(totalClaimedRewards).mul(PRECISION);
    //     // calculate block reward
    //     uint256 totalBlockReward = newTotalFarmRewards.sub(totalFarmRewards);
    //     // calculate next cumulative reward per token
    //     uint256 nextcumulativeRewardPerToken = cumulativeRewardPerToken.add(totalBlockReward.div(totalStaked));
    //     // return claimable reward for this account
    //     // prettier-ignore
    //     return claimableReward[account].add(
    //         staked[account].mul(nextcumulativeRewardPerToken.sub(previousCumulatedRewardPerToken[account])).div(PRECISION));
    // }

    function _distribute() internal {
        // pull TRU from distributor
        // only pull if there is distribution and distributor farm is set to this farm
        if (trueDistributor.nextDistribution() > 0 && trueDistributor.farm() == address(this)) {
            trueDistributor.distribute();
        }
        // calculate total rewards
        uint256 newTotalFarmRewards = trustToken.balanceOf(address(this)).add(rewards[address(this)].totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(rewards[address(this)].totalFarmRewards);
        // update farm rewards
        rewards[address(this)].totalFarmRewards = newTotalFarmRewards;
        // if there are stakers
        if (stakes[address(this)].totalStaked > 0) {
            rewards[address(this)].cumulativeRewardPerToken = rewards[address(this)].cumulativeRewardPerToken
                .add(totalBlockReward.div(stakes[address(this)].totalStaked));
        }
    }

    function _updateShares(address token) public {
        // claimableReward += staked(token) * (cumulativeRewardPerShare - previousCumulatedRewardPerShare(token))
        rewards[address(this)].claimableReward[token] = rewards[address(this)].claimableReward[token].add(
            stakes[address(this)].staked[token].mul(
                rewards[address(this)].cumulativeRewardPerToken
                    .sub(rewards[address(this)].previousCumulatedRewardPerToken[token])
            ).div(PRECISION)
        );
        rewards[address(this)].previousCumulatedRewardPerToken[token] = rewards[address(this)].cumulativeRewardPerToken;
    }

    function _updateRewardsForToken(address token) public {
        _updateShares(token);
        // calculate total rewards
        uint256 newTotalFarmRewards = rewards[address(this)].claimableReward[token].add(rewards[token].totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(rewards[token].totalFarmRewards);
        // update farm rewards
        rewards[token].totalFarmRewards = newTotalFarmRewards;
        // if there are stakers
        if (stakes[token].totalStaked > 0) {
            rewards[token].cumulativeRewardPerToken = rewards[token].cumulativeRewardPerToken
                .add(totalBlockReward.div(stakes[token].totalStaked));
        }

        // update claimable reward for sender
        rewards[token].claimableReward[msg.sender] = rewards[token].claimableReward[msg.sender].add(
            stakes[msg.sender].staked[token].mul(rewards[token].cumulativeRewardPerToken.sub(rewards[token].previousCumulatedRewardPerToken[msg.sender])).div(PRECISION)
        );
        // update previous cumulative for sender
        rewards[token].previousCumulatedRewardPerToken[msg.sender] = rewards[token].cumulativeRewardPerToken;
    }

    /**
     * @dev Update state and get TRU from distributor
     */
    modifier update(address token) {
        _distribute();
        _updateRewardsForToken(token);
        _;
    }
}
