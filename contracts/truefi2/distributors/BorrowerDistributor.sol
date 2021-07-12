// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ITrueLender2} from "../interface/ITrueLender2.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

/**
 * @title BorrowerDistributor
 * @dev Reward borrowers for taking out loans in TRU
 */
contract BorrowerDistributor is UpgradeableClaimable {
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
     * @notice Only lenders can distribute the reward
     */
    ITrueLender2 public lender;

    /**
     * @dev Reward rate is set as 1% by default(100). 2 decimals
     * so the actual reward can be calculated as: loan * rewardRate / 10000
     */
    uint256 public rewardRate;

    // ======= STORAGE DECLARATION END ============

    uint256 public constant BASIS_RATIO = 10000;

    modifier onlyLender() {
        // Modifier
        require(msg.sender == address(lender), "Only lender can call this.");
        _;
    }

    /** @notice setting TRU address
     */
    function initialize(
        IERC20 _rewardCurrency,
        ITrueLender2 _lender,
        uint256 _rewardRate
    ) external initializer {
        rewardCurrency = _rewardCurrency;
        lender = _lender;
        rewardRate = _rewardRate;
    }

    /** @notice setting reward rate
     */
    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        rewardRate = _rewardRate;
    }

    /** @notice Distribute reward
     */
    function distribute(address borrower, uint256 loanAmount) external onlyLender {
        uint256 rewardAmount = loanAmount.mul(rewardRate).div(BASIS_RATIO);
        rewardCurrency.safeTransfer(borrower, rewardAmount);
    }
}
