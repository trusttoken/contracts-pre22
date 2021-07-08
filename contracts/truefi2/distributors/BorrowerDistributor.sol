// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

/**
 * @title BorrowerRewardDistributor
 * @dev Reward borrowers for taking out loans in TRU
 */
contract BorrowerRewardDistributor is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    /**
     * @notice Will be TRU
     */
    IERC20 public rewardCurrency;

    /**
     * @notice Only lenders can adjust the reward rate and distribute the reward
     */
    address public lender;

    /**
     * @dev Reward rate is set as 1% by default. 2 decimals
     * so the actual reward can be calculated as: loan * rewardRate / 10000
     */
    uint256 public rewardRate = 100;

    modifier onlyLender() {
        // Modifier
        require(msg.sender == lender, "Only lender can call this.");
        _;
    }

    /** @notice setting TRU address
     */
    function initialize(IERC20 _rewardCurrency, address _lender) external initializer {
        rewardCurrency = _rewardCurrency;
        lender = _lender;
    }

    /** @notice setting reward rate
     */
    function setRewardRate(uint256 _rewardRate) external onlyLender {
        rewardRate = _rewardRate;
    }

    /** @notice Distribute reward
     */
    function distribute(address borrower, uint256 loanAmount) external onlyLender {
        uint256 rewardAmount = loanAmount.mul(rewardRate).div(10000);
        rewardCurrency.safeTransfer(borrower, rewardAmount);
    }
}
