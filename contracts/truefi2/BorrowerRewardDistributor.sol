// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @title BorrowerRewardDistributor
 * @dev Reward borrowers for taking out loans in TRU
 */

contract BorrowerRewardDistributor {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
     * @notice Will be TRU
     */
    IERC20 public rewardCurrency;

    /**
     * @dev Reward rate is set as 1% by default. 2 decimals
     * so the actual reward can be calculated as: loan * rewardRate / 10000
     */
    uint256 public rewardRate = 100;

    /** @notice setting TRU address
     */
    constructor(IERC20 _rewardCurrency) public {
        rewardCurrency = _rewardCurrency;
    }

    function setRewardRate(uint256 _rewardRate) external {
        require(_rewardRate < 10000, "Reward rate should be less than 10000(100%)");
        rewardRate = _rewardRate;
    }

    function distribute(address borrower, uint256 loanAmount) external {
        uint256 rewardAmount = loanAmount.mul(rewardRate).div(10000);
        uint256 balance = rewardCurrency.balanceOf(address(this));

        if (balance >= rewardAmount) {
            rewardCurrency.approve(borrower, rewardAmount);
            rewardCurrency.safeTransfer(borrower, rewardAmount);
        }
    }
}
