// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ITrueLender2} from "../interface/ITrueLender2.sol";
import {ILoanToken2} from "../interface/ILoanToken2.sol";
import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

/**
 * @title BorrowerDistributor
 * @dev Reward borrowers for taking out loans in TRU
 */
contract BorrowerDistributor is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20WithDecimals;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    /**
     * @notice Will be TRU
     */
    IERC20WithDecimals public rewardCurrency;

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
        IERC20WithDecimals _rewardCurrency,
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
    function distribute(ILoanToken2 loan) external onlyLender {
        uint256 loanRewardAmount = loan.amount().mul(rewardRate).div(BASIS_RATIO);
        uint256 truRewardAmount = loanRewardAmount.mul(10**rewardCurrency.decimals()).div(10**uint256(loan.token().decimals()));
        rewardCurrency.safeTransfer(loan.borrower(), truRewardAmount);
    }
}
