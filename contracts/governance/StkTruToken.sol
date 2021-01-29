// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "./VoteToken.sol";
import {ClaimableContract} from "../trusttoken/common/ClaimableContract.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";
import {ITrueDistributor} from "../truefi/interface/ITrueDistributor.sol";

contract StkTruToken is VoteToken, ClaimableContract, ReentrancyGuard {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;

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

    IERC20 public tru;
    IERC20 public tfusd;
    ITrueDistributor public distributor;

    uint256 stakeSupply;

    mapping(address => uint256) public cooldowns;
    uint256 public cooldownTime;
    uint256 public unstakePeriodDuration;

    mapping(IERC20 => FarmRewards) public farmRewards;

    event Stake(address indexed staker, uint256 amount);
    event Unstake(address indexed staker, uint256 burntAmount);
    event Claim(address indexed who, IERC20 indexed token, uint256 amountClaimed);
    event CooldownTimeChanged(uint256 newUnstakePeriodDuration);
    event UnstakePeriodDurationChanged(uint256 newUnstakePeriodDuration);

    function initialize(
        IERC20 _tru,
        IERC20 _tfusd,
        ITrueDistributor _distributor
    ) public {
        require(!initalized, "StkTruToken: Already initialized");
        tru = _tru;
        tfusd = _tfusd;
        distributor = _distributor;

        cooldownTime = 14 days;
        unstakePeriodDuration = 7 days;

        owner_ = msg.sender;
        initalized = true;
    }

    function setCooldownTime(uint256 newCooldownTime) external onlyOwner {
        cooldownTime = newCooldownTime;
        emit CooldownTimeChanged(newCooldownTime);
    }

    function setUnstakePeriodDuration(uint256 newUnstakePeriodDuration) external onlyOwner {
        unstakePeriodDuration = newUnstakePeriodDuration;
        emit UnstakePeriodDurationChanged(newUnstakePeriodDuration);
    }

    function stake(uint256 amount) external distribute update(tru) update(tfusd) {
        if (cooldowns[msg.sender].add(cooldownTime) >= block.timestamp) {
            cooldowns[msg.sender] = block.timestamp;
        }

        _mint(msg.sender, amount);
        stakeSupply = stakeSupply.add(amount);

        require(tru.transferFrom(msg.sender, address(this), amount));

        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 amount) external distribute update(tru) update(tfusd) nonReentrant {
        require(balanceOf[msg.sender] >= amount, "StkTruToken: Insufficient balance");
        require(unlockTime(msg.sender) <= block.timestamp, "StkTruToken: Stake on cooldown");

        _claim(tru);
        _claim(tfusd);

        uint256 amountToTransfer = amount.mul(stakeSupply).div(totalSupply);

        _burn(msg.sender, amount);
        stakeSupply = stakeSupply.sub(amountToTransfer);

        tru.transfer(msg.sender, amountToTransfer);

        emit Unstake(msg.sender, amount);
    }

    function cooldown() external {
        if (unlockTime(msg.sender) == type(uint256).max) {
            cooldowns[msg.sender] = block.timestamp;
        }
    }

    function unlockTime(address account) public view returns (uint256) {
        if (cooldowns[account] == 0 || cooldowns[account].add(cooldownTime).add(unstakePeriodDuration) < block.timestamp) {
            return type(uint256).max;
        }
        return cooldowns[account].add(cooldownTime);
    }

    /**
     * @dev Claim TRU rewards
     */
    function claim() external distribute update(tru) update(tfusd) {
        _claim(tru);
        _claim(tfusd);
    }

    /**
     * @dev View to estimate the claimable reward for an account
     * @return claimable rewards for account
     */
    function claimable(address account, IERC20 token) external view returns (uint256) {
        // estimate pending reward from distributor
        uint256 pending = token == tru ? distributor.nextDistribution() : 0;
        // calculate total rewards (including pending)
        uint256 newTotalFarmRewards = rewardBalance(token).add(pending).add(farmRewards[token].totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(farmRewards[token].totalFarmRewards);
        // calculate next cumulative reward per token
        uint256 nextCumulativeRewardPerToken = farmRewards[token].cumulativeRewardPerToken.add(totalBlockReward.div(totalSupply));
        // return claimable reward for this account
        return
            farmRewards[token].claimableReward[account].add(
                balanceOf[account]
                    .mul(nextCumulativeRewardPerToken.sub(farmRewards[token].previousCumulatedRewardPerToken[account]))
                    .div(PRECISION)
            );
    }

    function decimals() public override pure returns (uint8) {
        return 8;
    }

    function rounding() public pure returns (uint8) {
        return 8;
    }

    function name() public override pure returns (string memory) {
        return "Staked TrueFi";
    }

    function symbol() public override pure returns (string memory) {
        return "stkTRU";
    }

    /**
     * @dev Internal claim function
     */
    function _claim(IERC20 token) internal {
        farmRewards[token].totalClaimedRewards = farmRewards[token].totalClaimedRewards.add(
            farmRewards[token].claimableReward[msg.sender]
        );
        uint256 rewardToClaim = farmRewards[token].claimableReward[msg.sender];
        farmRewards[token].claimableReward[msg.sender] = 0;
        require(token.transfer(msg.sender, rewardToClaim));
        emit Claim(msg.sender, token, rewardToClaim);
    }

    function rewardBalance(IERC20 token) internal view returns (uint256) {
        if (token == tru) {
            return token.balanceOf(address(this)).sub(stakeSupply);
        }
        return token.balanceOf(address(this));
    }

    /**
     * Get TRU from distributor
     */
    modifier distribute() {
        // pull TRU from distributor
        // only pull if there is distribution and distributor farm is set to this farm
        if (distributor.nextDistribution() > 0 && distributor.farm() == address(this)) {
            distributor.distribute();
        }
        _;
    }

    /**
     * @dev Update rewards state for `token`
     */
    modifier update(IERC20 token) {
        // calculate total rewards
        uint256 newTotalFarmRewards = rewardBalance(token).add(farmRewards[token].totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(farmRewards[token].totalFarmRewards);
        // update farm rewards
        farmRewards[token].totalFarmRewards = newTotalFarmRewards;
        // if there are stakers
        if (totalSupply > 0) {
            farmRewards[token].cumulativeRewardPerToken = farmRewards[token].cumulativeRewardPerToken.add(
                totalBlockReward.div(totalSupply)
            );
        }
        // update claimable reward for sender
        farmRewards[token].claimableReward[msg.sender] = farmRewards[token].claimableReward[msg.sender].add(
            balanceOf[msg.sender]
                .mul(farmRewards[token].cumulativeRewardPerToken.sub(farmRewards[token].previousCumulatedRewardPerToken[msg.sender]))
                .div(PRECISION)
        );
        // update previous cumulative for sender
        farmRewards[token].previousCumulatedRewardPerToken[msg.sender] = farmRewards[token].cumulativeRewardPerToken;
        _;
    }
}
