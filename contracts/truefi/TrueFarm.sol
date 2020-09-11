// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TrueDistributor} from "./TrueDistributor.sol";
import {ITrueFarm} from "./ITrueFarm.sol";

contract TrueFarm is ITrueFarm {
    using SafeMath for uint256;

    ERC20 public stakingToken;
    ERC20 public rewardToken;
    TrueDistributor public trueDistributor;

    uint256 public totalStaked;
    mapping(address => uint256) public staked;

    uint256 public cumulativeRewardPerToken;
    mapping(address => uint256) public previousCumulatedRewardPerToken;
    mapping(address => uint256) public claimableReward;

    constructor(ERC20 _stakingToken, TrueDistributor _trueDistributor) public {
        stakingToken = _stakingToken;
        trueDistributor = _trueDistributor;
        rewardToken = _trueDistributor.token();
    }

    function stake(uint256 amount) public update {
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
        staked[msg.sender] += amount;
        totalStaked += amount;
    }

    function unstake(uint256 amount) public update {
        require(amount <= staked[msg.sender], "insufficient staking balance");
        require(stakingToken.transfer(msg.sender, amount));
        staked[msg.sender] -= amount;
        totalStaked -= amount;
    }

    function claim() public update {
        rewardToken.transfer(msg.sender, claimableReward[msg.sender]);
        claimableReward[msg.sender] = 0;
    }

    function onDistribute(uint256 amount) external override {
        require(msg.sender == address(trueDistributor), "not a distributor");
        if (totalStaked > 0) {
            cumulativeRewardPerToken += amount.div(totalStaked);
        }
        claimableReward[tx.origin] += trueDistributor.normalise(
            staked[tx.origin] * (cumulativeRewardPerToken - previousCumulatedRewardPerToken[tx.origin])
        );
        previousCumulatedRewardPerToken[tx.origin] = cumulativeRewardPerToken;
    }

    modifier update() {
        trueDistributor.distribute(address(this));
        _;
    }
}
