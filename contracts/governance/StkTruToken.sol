// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "./VoteToken.sol";
import {ClaimableContract} from "../trusttoken/common/ClaimableContract.sol";
import {ITrueDistributor} from "../truefi/interface/ITrueDistributor.sol";

/**
 * @title stkTRU
 * @dev Staking contract for TrueFi
 * TRU is staked and stored in the contract
 * stkTRU is minted when staking
 * Holders of stkTRU accrue rewards over time
 * Rewards are paid in TRU and tfUSD
 * stkTRU can be used to vote in governance
 * stkTRU can be used to rate and approve loans
 */
contract StkTruToken is VoteToken, ClaimableContract, ReentrancyGuard {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;
    uint256 constant MIN_DISTRIBUTED_AMOUNT = 100e8;

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

    struct ScheduledTfUsdRewards {
        uint64 timestamp;
        uint96 amount;
    }

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public tru;
    IERC20 public tfusd;
    ITrueDistributor public distributor;
    address public liquidator;

    uint256 public stakeSupply;

    mapping(address => uint256) cooldowns;
    uint256 public cooldownTime;
    uint256 public unstakePeriodDuration;

    mapping(IERC20 => FarmRewards) public farmRewards;

    uint32[] public sortedScheduledRewardIndices;
    ScheduledTfUsdRewards[] public scheduledRewards;
    uint256 public undistributedTfusdRewards;
    uint32 public nextDistributionIndex;

    // ======= STORAGE DECLARATION END ============

    event Stake(address indexed staker, uint256 amount);
    event Unstake(address indexed staker, uint256 burntAmount);
    event Claim(address indexed who, IERC20 indexed token, uint256 amountClaimed);
    event Withdraw(uint256 amount);
    event Cooldown(address indexed who, uint256 endTime);
    event CooldownTimeChanged(uint256 newUnstakePeriodDuration);
    event UnstakePeriodDurationChanged(uint256 newUnstakePeriodDuration);

    /**
     * @dev Only Liquidator contract can perform TRU liquidations
     */
    modifier onlyLiquidator() {
        require(msg.sender == liquidator, "StkTruToken: Can be called only by the liquidator");
        _;
    }

    /**
     * Get TRU from distributor
     */
    modifier distribute() {
        // pull TRU from distributor
        // do not pull small amounts to save some gas
        // only pull if there is distribution and distributor farm is set to this farm
        if (distributor.nextDistribution() > MIN_DISTRIBUTED_AMOUNT && distributor.farm() == address(this)) {
            distributor.distribute();
        }
        _;
    }

    modifier update(address account) {
        updateTotalRewards(tru);
        updateClaimableRewards(tru, account);
        updateTotalRewards(tfusd);
        updateClaimableRewards(tfusd, account);
        _;
    }

    /**
     * @dev Initialize contract and set default values
     * @param _tru TRU token
     * @param _tfusd tfUSD token
     * @param _distributor Distributor for this contract
     * @param _liquidator Liquidator for staked TRU
     */
    function initialize(
        IERC20 _tru,
        IERC20 _tfusd,
        ITrueDistributor _distributor,
        address _liquidator
    ) public {
        require(!initalized, "StkTruToken: Already initialized");
        tru = _tru;
        tfusd = _tfusd;
        distributor = _distributor;
        liquidator = _liquidator;

        cooldownTime = 14 days;
        unstakePeriodDuration = 2 days;

        owner_ = msg.sender;
        initalized = true;
    }

    /**
     * @dev Owner can use this function to set cooldown time
     * Cooldown time defines how long a staker waits to unstake TRU
     * @param newCooldownTime New cooldown time for stakers
     */
    function setCooldownTime(uint256 newCooldownTime) external onlyOwner {
        // Avoid overflow
        require(newCooldownTime <= 100 * 365 days, "StkTruToken: Cooldown too large");

        cooldownTime = newCooldownTime;
        emit CooldownTimeChanged(newCooldownTime);
    }

    /**
     * @dev Owner can set unstake period duration
     * Unstake period defines how long after cooldown a user has to withdraw stake
     * @param newUnstakePeriodDuration New unstake period
     */
    function setUnstakePeriodDuration(uint256 newUnstakePeriodDuration) external onlyOwner {
        require(newUnstakePeriodDuration > 0, "StkTruToken: Unstake period cannot be 0");
        // Avoid overflow
        require(newUnstakePeriodDuration <= 100 * 365 days, "StkTruToken: Unstake period too large");

        unstakePeriodDuration = newUnstakePeriodDuration;
        emit UnstakePeriodDurationChanged(newUnstakePeriodDuration);
    }

    /**
     * @dev Stake TRU for stkTRU
     * Updates rewards when staking
     * @param amount Amount of TRU to stake for stkTRU
     */
    function stake(uint256 amount) external distribute update(msg.sender) {
        require(amount > 0, "StkTruToken: Cannot stake 0");

        if (cooldowns[msg.sender] != 0 && cooldowns[msg.sender].add(cooldownTime) > block.timestamp) {
            cooldowns[msg.sender] = block.timestamp;
        }

        uint256 amountToMint = stakeSupply == 0 ? amount : amount.mul(totalSupply).div(stakeSupply);
        _mint(msg.sender, amountToMint);
        stakeSupply = stakeSupply.add(amount);

        require(tru.transferFrom(msg.sender, address(this), amount));

        emit Stake(msg.sender, amount);
    }

    /**
     * @dev Unstake stkTRU for TRU
     * Can only unstake when cooldown complete and within unstake period
     * Claims rewards when unstaking
     * @param amount Amount of stkTRU to unstake for TRU
     */
    function unstake(uint256 amount) external distribute update(msg.sender) nonReentrant {
        require(amount > 0, "StkTruToken: Cannot unstake 0");

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

    /**
     * @dev Initiate cooldown period
     */
    function cooldown() external {
        if (unlockTime(msg.sender) == type(uint256).max) {
            cooldowns[msg.sender] = block.timestamp;

            emit Cooldown(msg.sender, block.timestamp.add(cooldownTime));
        }
    }

    /**
     * @dev Withdraw TRU from the contract for liquidation
     * @param amount Amount to withdraw for liquidation
     */
    function withdraw(uint256 amount) external onlyLiquidator {
        stakeSupply = stakeSupply.sub(amount);
        tru.transfer(liquidator, amount);

        emit Withdraw(amount);
    }

    /**
     * @dev View function to get unlock time for an account
     * @param account Account to get unlock time for
     * @return Unlock time for account
     */
    function unlockTime(address account) public view returns (uint256) {
        if (cooldowns[account] == 0 || cooldowns[account].add(cooldownTime).add(unstakePeriodDuration) < block.timestamp) {
            return type(uint256).max;
        }
        return cooldowns[account].add(cooldownTime);
    }

    /**
     * @dev Give tfUSD as origination fee to stake.this
     * 50% are given immediately and 50% after `endTime` passes
     */
    function payFee(uint256 amount, uint256 endTime) external {
        require(endTime < type(uint64).max, "StkTruToken: time overflow");
        require(amount < type(uint96).max, "StkTruToken: amount overflow");

        require(tfusd.transferFrom(msg.sender, address(this), amount));
        undistributedTfusdRewards = undistributedTfusdRewards.add(amount.div(2));
        scheduledRewards.push(ScheduledTfUsdRewards({amount: uint96(amount.div(2)), timestamp: uint64(endTime)}));

        uint32 newIndex = findPositionForTimestamp(endTime);
        insertAt(newIndex, uint32(scheduledRewards.length) - 1);
    }

    /**
     * @dev Claim all rewards
     */
    function claim() external distribute update(msg.sender) {
        _claim(tru);
        _claim(tfusd);
    }

    /**
     * @dev View to estimate the claimable reward for an account
     * @param account Account to get claimable reward for
     * @param token Token to get rewards for
     * @return claimable rewards for account
     */
    function claimable(address account, IERC20 token) external view returns (uint256) {
        // estimate pending reward from distributor
        uint256 pending = token == tru ? distributor.nextDistribution() : 0;
        // calculate total rewards (including pending)
        uint256 newTotalFarmRewards = rewardBalance(token)
            .add(pending > MIN_DISTRIBUTED_AMOUNT ? pending : 0)
            .add(farmRewards[token].totalClaimedRewards)
            .mul(PRECISION);
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

    /**
     * @dev Prior votes votes are calculated as priorVotes * stakedSupply / totalSupply
     * This dilutes voting power when TRU is liquidated
     * @param account Account to get current voting power for
     * @param blockNumber Block to get prior votes at
     * @return prior voting power for account and block
     */
    function getPriorVotes(address account, uint256 blockNumber) public override view returns (uint96) {
        uint96 votes = super.getPriorVotes(account, blockNumber);
        return safe96(stakeSupply.mul(votes).div(totalSupply), "StkTruToken: uint96 overflow");
    }

    /**
     * @dev Current votes are calculated as votes * stakedSupply / totalSupply
     * This dilutes voting power when TRU is liquidated
     * @param account Account to get current voting power for
     * @return voting power for account
     */
    function getCurrentVotes(address account) public override view returns (uint96) {
        uint96 votes = super.getCurrentVotes(account);
        return safe96(stakeSupply.mul(votes).div(totalSupply), "StkTruToken: uint96 overflow");
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

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override distribute update(sender) {
        updateClaimableRewards(tru, recipient);
        updateClaimableRewards(tfusd, recipient);
        super._transfer(sender, recipient, amount);
    }

    /**
     * @dev Internal claim function
     * Claim rewards for a specific ERC20 token
     * @param token Token to claim rewards for
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

    /**
     * @dev Get reward balance of this contract for a token
     * @param token Token to get reward balance for
     * @return Reward balance for token
     */
    function rewardBalance(IERC20 token) internal view returns (uint256) {
        if (token == tru) {
            return token.balanceOf(address(this)).sub(stakeSupply);
        }
        return token.balanceOf(address(this)).sub(undistributedTfusdRewards);
    }

    /**
     * @dev Check if any scheduled rewards should be distributed
     */
    function distributeScheduledRewards() internal {
        uint32 index = nextDistributionIndex;
        while (index < scheduledRewards.length && scheduledRewards[sortedScheduledRewardIndices[index]].timestamp < block.timestamp) {
            undistributedTfusdRewards = undistributedTfusdRewards.sub(scheduledRewards[sortedScheduledRewardIndices[index]].amount);
            index++;
        }
        if (nextDistributionIndex != index) {
            nextDistributionIndex = index;
        }
    }

    /**
     * @dev Update rewards state for `token`
     */
    function updateTotalRewards(IERC20 token) internal {
        if (token == tfusd) {
            distributeScheduledRewards();
        }
        // calculate total rewards
        uint256 newTotalFarmRewards = rewardBalance(token).add(farmRewards[token].totalClaimedRewards).mul(PRECISION);
        if (newTotalFarmRewards == farmRewards[token].totalFarmRewards) {
            return;
        }
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
    }

    function updateClaimableRewards(IERC20 token, address user) internal {
        // update claimable reward for sender
        if (balanceOf[user] > 0) {
            farmRewards[token].claimableReward[user] = farmRewards[token].claimableReward[user].add(
                balanceOf[user]
                    .mul(farmRewards[token].cumulativeRewardPerToken.sub(farmRewards[token].previousCumulatedRewardPerToken[user]))
                    .div(PRECISION)
            );
        }
        // update previous cumulative for sender
        farmRewards[token].previousCumulatedRewardPerToken[user] = farmRewards[token].cumulativeRewardPerToken;
    }

    function findPositionForTimestamp(uint256 timestamp) internal view returns (uint32 i) {
        for (i = nextDistributionIndex; i < sortedScheduledRewardIndices.length; i++) {
            if (scheduledRewards[sortedScheduledRewardIndices[i]].timestamp > timestamp) {
                break;
            }
        }
    }

    function insertAt(uint32 index, uint32 value) internal {
        sortedScheduledRewardIndices.push(0);
        for (uint32 j = uint32(sortedScheduledRewardIndices.length) - 1; j > index; j--) {
            sortedScheduledRewardIndices[j] = sortedScheduledRewardIndices[j - 1];
        }
        sortedScheduledRewardIndices[index] = value;
    }
}
