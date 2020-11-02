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

    function stake(uint256 amount) external override update {
        staked[msg.sender] = staked[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
        emit Stake(msg.sender, amount);
    }

    function _unstake(uint256 amount) internal {
        require(amount <= staked[msg.sender], "TrueFarm: Cannot withdraw amount bigger than available balance");
        staked[msg.sender] = staked[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        require(stakingToken.transfer(msg.sender, amount));
        emit Unstake(msg.sender, amount);
    }

    function _claim() internal {
        totalClaimedRewards = totalClaimedRewards.add(claimableReward[msg.sender]);
        uint256 rewardToClaim = claimableReward[msg.sender];
        claimableReward[msg.sender] = 0;
        require(trustToken.transfer(msg.sender, rewardToClaim));
        emit Claim(msg.sender, rewardToClaim);
    }

    function unstake(uint256 amount) external override update {
        _unstake(amount);
    }

    function claim() external override update {
        _claim();
    }

    function exit(uint256 amount) external override update {
        _unstake(amount);
        _claim();
    }

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
