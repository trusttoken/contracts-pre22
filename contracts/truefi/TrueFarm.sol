// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Initializable} from "./common/Initializable.sol";
import {ITrueDistributor} from "./interface/ITrueDistributor.sol";
import {ITrueFarm} from "./interface/ITrueFarm.sol";

/**
 * @title TrueFarm
 * @notice Deposit liquidity tokens to earn TRU rewards over time
 * @dev Staking pool where tokens are staked for TRU rewards
 * A Distributor contract decides how much TRU a farm can earn over time
 */
contract TrueFarm is ITrueFarm, Initializable {
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
    uint256 public cumulativeRewardPerToken;
    // track previous cumulate rewards for accounts
    mapping(address => uint256) public previousCumulatedRewardPerToken;
    // track claimable rewards for accounts
    mapping(address => uint256) public claimableReward;

    // track total rewards
    uint256 public totalClaimedRewards;
    uint256 public totalFarmRewards;

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
     * @dev Initalize staking pool with a Distributor contraxct
     * The distributor contract calculates how much TRU rewards this contract
     * gets, and stores TRU for distribution.
     * @param _stakingToken Token to stake
     * @param _trueDistributor Distributor contract
     * @param _name Farm name
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
        emit Stake(msg.sender, amount);
    }

    /**
     * @dev Internal unstake function
     * @param amount Amount of tokens to unstake
     */
    function _unstake(uint256 amount) internal {
        require(amount <= staked[msg.sender], "TrueFarm: Cannot withdraw amount bigger than available balance");
        staked[msg.sender] = staked[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        require(stakingToken.transfer(msg.sender, amount));
        emit Unstake(msg.sender, amount);
    }

    /**
     * @dev Internal claim function
     */
    function _claim() internal {
        totalClaimedRewards = totalClaimedRewards.add(claimableReward[msg.sender]);
        uint256 rewardToClaim = claimableReward[msg.sender];
        claimableReward[msg.sender] = 0;
        require(trustToken.transfer(msg.sender, rewardToClaim));
        emit Claim(msg.sender, rewardToClaim);
    }

    /**
     * @dev Remove staked tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external override update {
        _unstake(amount);
    }

    /**
     * @dev Claim TRU rewards
     */
    function claim() external override update {
        _claim();
    }

    /**
     * @dev Unstake amount and claim rewards
     * @param amount Amount of tokens to unstake
     */
    function exit(uint256 amount) external override update {
        _unstake(amount);
        _claim();
    }

    /**
     * @dev Update state and get TRU from distributor
     */
    modifier update() {
        // pull TRU from distributor
        trueDistributor.distribute(address(this));
        // calculate total rewards
        uint256 newTotalFarmRewards = trustToken.balanceOf(address(this)).add(totalClaimedRewards).mul(PRECISION);
        // calculate block reward
        uint256 totalBlockReward = newTotalFarmRewards.sub(totalFarmRewards);
        // update farm rewards
        totalFarmRewards = newTotalFarmRewards;
        // if there are stakers
        if (totalStaked > 0) {
            cumulativeRewardPerToken = cumulativeRewardPerToken.add(totalBlockReward.div(totalStaked));
        }
        // update claimable reward for sender
        claimableReward[msg.sender] = claimableReward[msg.sender].add(
            staked[msg.sender].mul(cumulativeRewardPerToken.sub(previousCumulatedRewardPerToken[msg.sender])).div(PRECISION)
        );
        // update previous cumulative for sender
        previousCumulatedRewardPerToken[msg.sender] = cumulativeRewardPerToken;
        _;
    }
}
