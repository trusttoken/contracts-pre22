// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Initializable} from "./common/Initializable.sol";
import {IMasterChef} from "./interface/IMasterChef.sol";
import {ITrueDistributor} from "./interface/ITrueDistributor.sol";
import {ITrueFarm} from "./interface/ITrueFarm.sol";

/**
 * @title TrueSushiFarm
 * @notice Deposit liquidity tokens to earn TRU rewards over time
 * @dev Staking pool where tokens are staked for TRU rewards
 * A Distributor contract decides how much TRU a farm can earn over time
 */
contract TrueSushiFarm is ITrueFarm, Initializable {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public override stakingToken;
    IERC20 public override trustToken;
    ITrueDistributor public override trueDistributor;
    string public override name;

    // track stakes
    uint256 public override totalStaked;
    mapping(address => uint256) public staked;

    // track overall cumulative rewards
    mapping(IERC20 => uint256) public cumulativeRewardPerToken;
    // track previous cumulate rewards for accounts
    mapping(IERC20 => mapping(address => uint256)) public previousCumulatedRewardPerToken;
    // track claimable rewards for accounts
    mapping(IERC20 => mapping(address => uint256)) public claimableReward;

    // track total rewards
    mapping(IERC20 => uint256) public totalClaimedRewards;
    mapping(IERC20 => uint256) public totalFarmRewards;

    IMasterChef public masterChef;
    uint256 public sushiPoolId;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when an account stakes
     * @param who Account staking
     * @param amountStaked Amount of tokens staked
     */
    event Stake(address indexed who, uint256 amountStaked);

    /**
     * @dev Emitted when an account unstakes
     * @param who Account unstaking
     * @param amountUnstaked Amount of tokens unstaked
     */
    event Unstake(address indexed who, uint256 amountUnstaked);

    /**
     * @dev Emitted when an account claims TRU rewards
     * @param who Account claiming
     * @param amountClaimed Amount of TRU claimed
     */
    event Claim(address indexed who, uint256 amountClaimed);

    /**
     * @dev Initalize staking pool with a Distributor contract
     * The distributor contract calculates how much TRU rewards this contract
     * gets, and stores TRU for distribution.
     * @param _stakingToken Token to stake
     * @param _trueDistributor Distributor contract
     * @param _name Farm name
     */
    function initialize(
        IERC20 _stakingToken,
        ITrueDistributor _trueDistributor,
        IMasterChef _masterChef,
        uint256 _sushiPoolId,
        string memory _name
    ) public initializer {
        stakingToken = _stakingToken;
        trueDistributor = _trueDistributor;
        trustToken = _trueDistributor.trustToken();
        masterChef = _masterChef;
        sushiPoolId = _sushiPoolId;
        name = _name;
        require(trueDistributor.farm() == address(this), "TrueSushiFarm: Distributor farm is not set");
    }

    /**
     * @dev Stake tokens for TRU rewards.
     * Also claims any existing rewards.
     * @param amount Amount of tokens to stake
     */
    function _stake(uint256 amount) internal {
        staked[msg.sender] = staked[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
        emit Stake(msg.sender, amount);
    }

    /**
     * @dev Internal unstake function
     * @param amount Amount of tokens to unstake
     */
    function _unstake(uint256 amount) internal {
        require(amount <= staked[msg.sender], "TrueSushiFarm: Cannot withdraw amount bigger than available balance");
        staked[msg.sender] = staked[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        require(stakingToken.transfer(msg.sender, amount));
        emit Unstake(msg.sender, amount);
    }

    /**
     * @dev Internal claim function
     */
    function _claim(IERC20 token) internal {
        totalClaimedRewards[token] = totalClaimedRewards[token].add(claimableReward[token][msg.sender]);
        uint256 rewardToClaim = claimableReward[token][msg.sender];
        claimableReward[token][msg.sender] = 0;
        require(token.transfer(msg.sender, rewardToClaim));
        emit Claim(msg.sender, rewardToClaim);
    }

    function _deposit(uint256 amount) internal {
        stakingToken.approve(address(masterChef), amount);
        masterChef.deposit(sushiPoolId, amount);
    }

    function _withdraw(uint256 amount) internal {
        masterChef.withdraw(sushiPoolId, amount);
    }

    /**
     * @dev Stake tokens
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external override {
        _updateTru();
        _stake(amount);
        _deposit(amount);
        _claim(trustToken);
    }

    /**
     * @dev Remove staked tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external override {
        _updateTru();
        _withdraw(amount);
        _unstake(amount);
    }

    /**
     * @dev Claim TRU rewards
     */
    function claim() external override {
        _updateTru();
        _claim(trustToken);
    }

    /**
     * @dev Unstake amount and claim rewards
     * @param amount Amount of tokens to unstake
     */
    function exit(uint256 amount) external override {
        _updateTru();
        _unstake(amount);
        _claim(trustToken);
    }

    /**
     * @dev View to estimate the claimable reward for an account
     * @return claimable rewards for account
     */
    function claimable(address account, IERC20 token) external view returns (uint256) {
        if (staked[account] == 0) {
            return claimableReward[token][account];
        }
        // estimate pending reward from distributor
        uint256 pending = trueDistributor.nextDistribution();
        // calculate total rewards (including pending)
        uint256 newTotalFarmRewards = token.balanceOf(address(this)).add(pending).add(totalClaimedRewards[token]).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(totalFarmRewards[token]);
        // calculate next cumulative reward per token
        uint256 nextCumulativeRewardPerToken = cumulativeRewardPerToken[token].add(totalBlockReward.div(totalStaked));
        // return claimable reward for this account
        // prettier-ignore
        return claimableReward[token][account].add(
            staked[account].mul(nextCumulativeRewardPerToken.sub(previousCumulatedRewardPerToken[token][account])).div(PRECISION));
    }

    /**
     * @dev Update state and get TRU from distributor
     */
    function _updateTru() internal {
        // pull TRU from distributor
        // only pull if there is distribution and distributor farm is set to this farm
        if (trueDistributor.nextDistribution() > 0 && trueDistributor.farm() == address(this)) {
            trueDistributor.distribute();
        }
        // calculate total rewards
        uint256 newTotalFarmRewards = trustToken.balanceOf(address(this)).add(totalClaimedRewards[trustToken]).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(totalFarmRewards[trustToken]);
        // update farm rewards
        totalFarmRewards[trustToken] = newTotalFarmRewards;
        // if there are stakers
        if (totalStaked > 0) {
            cumulativeRewardPerToken[trustToken] = cumulativeRewardPerToken[trustToken].add(totalBlockReward.div(totalStaked));
        }
        // update claimable reward for sender
        claimableReward[trustToken][msg.sender] = claimableReward[trustToken][msg.sender].add(
            staked[msg.sender].mul(cumulativeRewardPerToken[trustToken].sub(previousCumulatedRewardPerToken[trustToken][msg.sender])).div(PRECISION)
        );
        // update previous cumulative for sender
        previousCumulatedRewardPerToken[trustToken][msg.sender] = cumulativeRewardPerToken[trustToken];
    }
}
