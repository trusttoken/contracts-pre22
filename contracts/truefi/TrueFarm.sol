// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TrueDistributor} from "./TrueDistributor.sol";

contract TrueFarm {
    using SafeMath for uint256;
    uint256 constant PRECISION = 1e30;

    ERC20 public stakingToken;
    ERC20 public trustToken;
    TrueDistributor public trueDistributor;

    uint256 public totalStaked;
    mapping(address => uint256) public staked;

    uint256 public cumulativeRewardPerToken;
    mapping(address => uint256) public previousCumulatedRewardPerToken;
    mapping(address => uint256) public claimableReward;

    uint256 public totalClaimedRewards;
    uint256 public totalFarmRewards;

    constructor(ERC20 _stakingToken, TrueDistributor _trueDistributor) public {
        stakingToken = _stakingToken;
        trueDistributor = _trueDistributor;
        trustToken = _trueDistributor.trustToken();
    }

    function stake(uint256 amount) public update {
        staked[msg.sender] = staked[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
    }

    function unstake(uint256 amount) public update {
        require(amount <= staked[msg.sender], "insufficient staking balance");
        staked[msg.sender] = staked[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        require(stakingToken.transfer(msg.sender, amount));
    }

    function claim() public update {
        totalClaimedRewards = totalClaimedRewards.add(claimableReward[msg.sender]);
        uint256 rewardToClaim = claimableReward[msg.sender];
        claimableReward[msg.sender] = 0;
        require(trustToken.transfer(msg.sender, rewardToClaim));
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
