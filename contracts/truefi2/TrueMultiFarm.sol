// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITrueDistributor} from "../truefi/interface/ITrueDistributor.sol";
import {ITrueMultiFarm} from "./interface/ITrueMultiFarm.sol";

/**
 * @title TrueMultiFarm
 * @notice Deposit liquidity tokens to earn TRU rewards over time
 * @dev Staking pool where tokens are staked for TRU rewards
 * A Distributor contract decides how much TRU all farms in total can earn over time
 * Calling setShare() by owner decides ratio of rewards going to respective token farms
 * You can think of this contract as of a farm that is a distributor to the multiple other farms
 * A share of a farm in the multifarm is it's stake
 */
contract TrueMultiFarm is ITrueMultiFarm, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    uint256 private constant PRECISION = 1e30;

    struct Stakes {
        // total amount of a particular token staked
        uint256 totalStaked;
        // who staked how much
        mapping(address => uint256) staked;
    }

    struct Rewards {
        // track overall cumulative rewards
        uint256 cumulativeRewardPerToken;
        // track previous cumulate rewards for accounts
        mapping(address => uint256) previousCumulatedRewardPerToken;
        // track claimable rewards for accounts
        mapping(address => uint256) claimableReward;
        // track total rewards
        uint256 totalClaimedRewards;
        uint256 totalRewards;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public rewardToken;
    ITrueDistributor public override trueDistributor;

    mapping(IERC20 => Stakes) public stakes;
    mapping(IERC20 => Rewards) public stakerRewards;

    // Shares of farms in the multifarm
    Stakes public shares;
    // Total rewards per farm
    Rewards public farmRewards;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when an account stakes
     * @param who Account staking
     * @param amountStaked Amount of tokens staked
     */
    event Stake(IERC20 indexed token, address indexed who, uint256 amountStaked);

    /**
     * @dev Emitted when an account unstakes
     * @param who Account unstaking
     * @param amountUnstaked Amount of tokens unstaked
     */
    event Unstake(IERC20 indexed token, address indexed who, uint256 amountUnstaked);

    /**
     * @dev Emitted when an account claims TRU rewards
     * @param who Account claiming
     * @param amountClaimed Amount of TRU claimed
     */
    event Claim(IERC20 indexed token, address indexed who, uint256 amountClaimed);

    /**
     * @dev Update all rewards associated with the token and msg.sender
     */
    modifier update(IERC20 token) {
        distribute();
        updateRewards(token);
        _;
    }

    /**
     * @dev Is there any reward allocatiion for given token
     */
    modifier hasShares(IERC20 token) {
        require(shares.staked[address(token)] > 0, "TrueMultiFarm: This token has no shares");
        _;
    }

    /**
     * @dev How much is staked by staker on token farm
     */
    function staked(IERC20 token, address staker) public view returns (uint256) {
        return stakes[token].staked[staker];
    }

    /**
     * @dev Initialize staking pool with a Distributor contract
     * The distributor contract calculates how much TRU rewards this contract
     * gets, and stores TRU for distribution.
     * @param _trueDistributor Distributor contract
     */
    function initialize(ITrueDistributor _trueDistributor) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        trueDistributor = _trueDistributor;
        rewardToken = _trueDistributor.trustToken();
        require(trueDistributor.farm() == address(this), "TrueMultiFarm: Distributor farm is not set");
    }

    /**
     * @dev Stake tokens for TRU rewards.
     * Also claims any existing rewards.
     * @param amount Amount of tokens to stake
     */
    function stake(IERC20 token, uint256 amount) external override hasShares(token) update(token) {
        if (stakerRewards[token].claimableReward[msg.sender] > 0) {
            _claim(token);
        }
        stakes[token].staked[msg.sender] = stakes[token].staked[msg.sender].add(amount);
        stakes[token].totalStaked = stakes[token].totalStaked.add(amount);

        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Stake(token, msg.sender, amount);
    }

    /**
     * @dev Remove staked tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(IERC20 token, uint256 amount) external override update(token) {
        _unstake(token, amount);
    }

    /**
     * @dev Claim TRU rewards
     */
    function claim(IERC20[] calldata tokens) external override {
        distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            updateRewards(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            _claim(tokens[i]);
        }
    }

    /**
     * @dev Unstake amount and claim rewards
     */
    function exit(IERC20[] calldata tokens) external override {
        distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            updateRewards(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            _unstake(tokens[i], stakes[tokens[i]].staked[msg.sender]);
            _claim(tokens[i]);
        }
    }

    /**
     * @dev Set shares for farms
     * Example: setShares([DAI, USDC], [1, 2]) will ensure that 33.(3)% of rewards will go to DAI farm and rest to USDC farm
     * If later setShares([DAI, TUSD], [2, 1]) will be called then shares of DAI will grow to 2, shares of USDC won't change and shares of TUSD will be 1
     * So this will give 40% of rewards going to DAI farm, 40% to USDC and 20% to TUSD
     * @param tokens Token addresses
     * @param updatedShares share of the i-th token in the multifarm
     */
    function setShares(IERC20[] calldata tokens, uint256[] calldata updatedShares) public onlyOwner {
        require(tokens.length == updatedShares.length, "TrueMultiFarm: Array lengths mismatch");
        distribute();
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateClaimableRewardsForFarm(tokens[i]);
        }
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 oldStaked = shares.staked[address(tokens[i])];
            shares.staked[address(tokens[i])] = updatedShares[i];
            shares.totalStaked = shares.totalStaked.sub(oldStaked).add(updatedShares[i]);
        }
    }

    /**
     * @dev Internal unstake function
     * @param amount Amount of tokens to unstake
     */
    function _unstake(IERC20 token, uint256 amount) internal {
        require(amount <= stakes[token].staked[msg.sender], "TrueMultiFarm: Cannot withdraw amount bigger than available balance");
        stakes[token].staked[msg.sender] = stakes[token].staked[msg.sender].sub(amount);
        stakes[token].totalStaked = stakes[token].totalStaked.sub(amount);

        token.safeTransfer(msg.sender, amount);
        emit Unstake(token, msg.sender, amount);
    }

    /**
     * @dev Internal claim function
     */
    function _claim(IERC20 token) internal {
        uint256 rewardToClaim = stakerRewards[token].claimableReward[msg.sender];

        stakerRewards[token].totalClaimedRewards = stakerRewards[token].totalClaimedRewards.add(rewardToClaim);
        farmRewards.totalClaimedRewards = farmRewards.totalClaimedRewards.add(rewardToClaim);

        stakerRewards[token].claimableReward[msg.sender] = 0;
        farmRewards.claimableReward[address(token)] = farmRewards.claimableReward[address(token)].sub(rewardToClaim);

        require(rewardToken.transfer(msg.sender, rewardToClaim));
        emit Claim(token, msg.sender, rewardToClaim);
    }

    /**
     * @dev View to estimate the claimable reward for an account that is staking token
     * @return claimable rewards for account
     */
    function claimable(IERC20 token, address account) external view returns (uint256) {
        if (stakes[token].staked[account] == 0) {
            return stakerRewards[token].claimableReward[account];
        }
        // estimate pending reward from distributor
        uint256 pending = _pendingDistribution(token);
        // calculate total rewards (including pending)
        uint256 newTotalRewards = pending.add(stakerRewards[token].totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalRewards.sub(stakerRewards[token].totalRewards);
        // calculate next cumulative reward per token
        uint256 nextcumulativeRewardPerToken = stakerRewards[token].cumulativeRewardPerToken.add(
            totalBlockReward.div(stakes[token].totalStaked)
        );
        // return claimable reward for this account
        return
            stakerRewards[token].claimableReward[account].add(
                stakes[token].staked[account]
                    .mul(nextcumulativeRewardPerToken.sub(stakerRewards[token].previousCumulatedRewardPerToken[account]))
                    .div(PRECISION)
            );
    }

    function _pendingDistribution(IERC20 token) internal view returns (uint256) {
        // estimate pending reward from distributor
        uint256 pending = trueDistributor.farm() == address(this) ? trueDistributor.nextDistribution() : 0;

        // calculate new total rewards ever received by farm
        uint256 newTotalRewards = rewardToken.balanceOf(address(this)).add(pending).add(farmRewards.totalClaimedRewards).mul(
            PRECISION
        );
        // calculate new rewards that were received since previous distribution
        uint256 totalBlockReward = newTotalRewards.sub(farmRewards.totalRewards);

        uint256 cumulativeRewardPerShare = farmRewards.cumulativeRewardPerToken;
        if (shares.totalStaked > 0) {
            cumulativeRewardPerShare = cumulativeRewardPerShare.add(totalBlockReward.div(shares.totalStaked));
        }

        uint256 newReward = shares.staked[address(token)]
            .mul(cumulativeRewardPerShare.sub(farmRewards.previousCumulatedRewardPerToken[address(token)]))
            .div(PRECISION);

        return farmRewards.claimableReward[address(token)].add(newReward);
    }

    /**
     * @dev Distribute rewards from distributor and increase cumulativeRewardPerShare in Multifarm
     */
    function distribute() internal {
        // pull TRU from distributor
        // only pull if there is distribution and distributor farm is set to this farm
        if (trueDistributor.nextDistribution() > 0 && trueDistributor.farm() == address(this)) {
            trueDistributor.distribute();
        }
        _updateCumulativeRewardPerShare();
    }

    /**
     * @dev This function must be called before any change of token share in multifarm happens (e.g. before shares.totalStaked changes)
     * This will also update cumulativeRewardPerToken after distribution has happened
     * 1. Get total lifetime rewards as Balance of TRU plus total rewards that have already been claimed
     * 2. See how much reward we got since previous update (R)
     * 3. Increase cumulativeRewardPerToken by R/total shares
     */
    function _updateCumulativeRewardPerShare() internal {
        // calculate new total rewards ever received by farm
        uint256 newTotalRewards = rewardToken.balanceOf(address(this)).add(farmRewards.totalClaimedRewards).mul(PRECISION);
        // calculate new rewards that were received since previous distribution
        uint256 rewardSinceLastUpdate = newTotalRewards.sub(farmRewards.totalRewards);
        // update info about total farm rewards
        farmRewards.totalRewards = newTotalRewards;
        // if there are sub farms increase their value per share
        if (shares.totalStaked > 0) {
            farmRewards.cumulativeRewardPerToken = farmRewards.cumulativeRewardPerToken.add(
                rewardSinceLastUpdate.div(shares.totalStaked)
            );
        }
    }

    /**
     * @dev Update rewards for the farm on token and for the staker.
     * The function must be called before any modification of staker's stake and to update values when claiming rewards
     */
    function updateRewards(IERC20 token) internal {
        _updateTokenFarmRewards(token);
        _updateClaimableRewardsForStaker(token);
    }

    /**
     * @dev Update rewards data for the token farm - update all values associated with total available rewards for the farm inside multifarm
     */
    function _updateTokenFarmRewards(IERC20 token) internal {
        _updateClaimableRewardsForFarm(token);
        _updateTotalRewards(token);
    }

    /**
     * @dev Increase total claimable rewards for token farm in multifarm.
     * This function must be called before share of the token in multifarm is changed and to update total claimable rewards for the staker
     */
    function _updateClaimableRewardsForFarm(IERC20 token) internal {
        if (shares.staked[address(token)] == 0) {
            return;
        }
        // claimableReward += staked(token) * (cumulativeRewardPerShare - previousCumulatedRewardPerShare(token))
        uint256 newReward = shares.staked[address(token)]
            .mul(farmRewards.cumulativeRewardPerToken.sub(farmRewards.previousCumulatedRewardPerToken[address(token)]))
            .div(PRECISION);

        farmRewards.claimableReward[address(token)] = farmRewards.claimableReward[address(token)].add(newReward);
        farmRewards.previousCumulatedRewardPerToken[address(token)] = farmRewards.cumulativeRewardPerToken;
    }

    /**
     * @dev Update total reward for the farm
     * Get total farm reward as claimable rewards for the given farm plus total rewards claimed by stakers in the farm
     */
    function _updateTotalRewards(IERC20 token) internal {
        uint256 totalRewards = farmRewards.claimableReward[address(token)].add(stakerRewards[token].totalClaimedRewards).mul(
            PRECISION
        );
        // calculate received reward
        uint256 rewardReceivedSinceLastUpdate = totalRewards.sub(stakerRewards[token].totalRewards);

        // if there are stakers of the token, increase cumulativeRewardPerToken by newly received reward per total staked amount
        if (stakes[token].totalStaked > 0) {
            stakerRewards[token].cumulativeRewardPerToken = stakerRewards[token].cumulativeRewardPerToken.add(
                rewardReceivedSinceLastUpdate.div(stakes[token].totalStaked)
            );
        }

        // update farm rewards
        stakerRewards[token].totalRewards = totalRewards;
    }

    /**
     * @dev Update claimable rewards for the msg.sender who is staking this token
     * Increase claimable reward by the number that is
     * staker's stake times the change of cumulativeRewardPerToken for the given token since this function was previously called
     * This method must be called before any change of staker's stake
     */
    function _updateClaimableRewardsForStaker(IERC20 token) internal {
        // increase claimable reward for sender by amount staked by the staker times the growth of cumulativeRewardPerToken since last update
        stakerRewards[token].claimableReward[msg.sender] = stakerRewards[token].claimableReward[msg.sender].add(
            stakes[token].staked[msg.sender]
                .mul(
                stakerRewards[token].cumulativeRewardPerToken.sub(stakerRewards[token].previousCumulatedRewardPerToken[msg.sender])
            )
                .div(PRECISION)
        );

        // update previous cumulative for sender
        stakerRewards[token].previousCumulatedRewardPerToken[msg.sender] = stakerRewards[token].cumulativeRewardPerToken;
    }
}
