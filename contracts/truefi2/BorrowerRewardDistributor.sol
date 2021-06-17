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
     * @dev Reward rate is set as 1% by default.
     * so the actual reward can be calculated as: loan / rewardRate
     */
    uint256 public rewardRate = 100;

    /** @notice setting TRU address
     */
    constructor(IERC20 _rewardCurrency) public {
        rewardCurrency = _rewardCurrency;
    }

    function setRewardRate(uint256 _rewardRate) external {
        require(_rewardRate > 0 && _rewardRate < 100, "Reward rate should greater than 0 and less than 100");
        rewardRate = _rewardRate;
    }

    function distribute(address borrower, uint256 loanAmount) external {
        rewardCurrency.safeTransfer(borrower, loanAmount.div(rewardRate));
    }
}
