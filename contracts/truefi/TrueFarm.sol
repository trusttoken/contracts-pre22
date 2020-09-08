// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TrueDistributor} from "./TrueDistributor.sol";

contract TrueFarm {
    using SafeMath for uint256;

    ERC20 public stakingToken;
    ERC20 public rewardToken;
    TrueDistributor public trueDistributor;

    uint256 public accumulatedRewardPerToken;
    mapping (address => uint) public initialAccumulatedRewardPerToken;
    mapping (address => uint) public rewardEarned;
    mapping (address => uint) public staked;

    constructor(ERC20 _stakingToken, TrueDistributor _trueDistributor) public {
        stakingToken = _stakingToken;
        trueDistributor = _trueDistributor;
        rewardToken = _trueDistributor.token();
    }

    function stake(uint256 amount) public update {
        require(stakingToken.transferFrom(msg.sender, address(this), amount));
        staked[msg.sender] = amount;
    }

    function unstake(uint256 amount) public {
    }

    function claim() update public {
        rewardToken.transfer(msg.sender, rewardEarned[msg.sender]);
    }

    modifier update() {
        uint256 totalBlockReward = trueDistributor.distribute(address(this));
        uint256 totalStaked = stakingToken.balanceOf(address(this));
        if (totalStaked > 0) {
            accumulatedRewardPerToken += totalBlockReward.div(totalStaked);
        }
        rewardEarned[msg.sender] += staked[msg.sender] * (accumulatedRewardPerToken - initialAccumulatedRewardPerToken[msg.sender]);
        initialAccumulatedRewardPerToken[msg.sender] = accumulatedRewardPerToken;
        _;
    }

}
