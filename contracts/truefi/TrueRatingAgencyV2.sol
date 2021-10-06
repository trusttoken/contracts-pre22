// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20WithDecimals} from "../truefi2/interface/IERC20WithDecimals.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {IBurnableERC20} from "../trusttoken/interface/IBurnableERC20.sol";
import {IVoteTokenWithERC20} from "../governance/interface/IVoteToken.sol";

import {Ownable} from "../common/UpgradeableOwnable.sol";
import {IArbitraryDistributor} from "./interface/IArbitraryDistributor.sol";
import {ILoanFactory} from "./interface/ILoanFactory.sol";
import {ILoanToken2} from "../truefi2/interface/ILoanToken2.sol";
import {ITrueRatingAgencyV2} from "./interface/ITrueRatingAgencyV2.sol";

/**
 * @title TrueRatingAgencyV2
 * @dev Credit prediction market for LoanTokens
 *
 * TrueFi uses use a prediction market to signal how risky a loan is.
 * The Credit Prediction Market estimates the likelihood of a loan defaulting.
 * Any stkTRU holder can rate YES or NO and stake TRU as collateral on their rate.
 * Voting weight is equal to delegated governance power (see VoteToken.sol)
 * If a loan is funded, TRU is rewarded as incentive for participation
 * Rating stkTRU in the prediction market allows raters to earn and claim TRU
 * incentive when the loan is approved
 *
 * Voting Lifecycle:
 * - Borrowers can apply for loans at any time by deploying a LoanToken
 * - LoanTokens are registered with the prediction market contract
 * - Once registered, stkTRU holders can rate at any time
 *
 * States:
 * Void:        Rated loan is invalid
 * Pending:     Waiting to be funded
 * Retracted:   Rating has been cancelled
 * Running:     Rated loan has been funded
 * Settled:     Rated loan has been paid back in full
 * Defaulted:   Rated loan has not been paid back in full
 * Liquidated:  Rated loan has defaulted and stakers have been liquidated
 */
contract TrueRatingAgencyV2 is ITrueRatingAgencyV2, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IBurnableERC20;

    enum LoanStatus {Void, Pending, Retracted, Running, Settled, Defaulted, Liquidated}

    struct Loan {
        address creator;
        uint256 timestamp;
        uint256 blockNumber;
        mapping(bool => uint256) prediction;
        mapping(address => mapping(bool => uint256)) ratings;
        mapping(address => uint256) claimed;
        uint256 reward;
    }

    // TRU is 1e8 decimals
    uint256 private constant TOKEN_PRECISION_DIFFERENCE = 10**10;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => bool) private DEPRECATED__allowedSubmitters;
    mapping(address => Loan) public loans;

    IBurnableERC20 public TRU;
    IVoteTokenWithERC20 public stkTRU;
    IArbitraryDistributor public distributor;
    address private DEPRECATED__factory;

    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public ratersRewardFactor;

    // reward multiplier for raters
    uint256 public rewardMultiplier;

    // are submissions paused?
    bool private DEPRECATED__submissionPauseStatus;

    mapping(address => bool) private DEPRECATED__canChangeAllowance;

    // ======= STORAGE DECLARATION END ============

    event RatersRewardFactorChanged(uint256 ratersRewardFactor);
    event RewardMultiplierChanged(uint256 newRewardMultiplier);
    event Claimed(address loanToken, address rater, uint256 claimedReward);

    /**
     * @dev Only loans that have been funded
     */
    modifier onlyFundedLoans(address id) {
        require(status(id) >= LoanStatus.Running, "TrueRatingAgencyV2: Loan was not funded");
        _;
    }

    /**
     * @dev Initialize Rating Agency
     * Distributor contract decides how much TRU is rewarded to stakers
     * @param _TRU TRU contract
     * @param _distributor Distributor contract
     */
    function initialize(
        IBurnableERC20 _TRU,
        IVoteTokenWithERC20 _stkTRU,
        IArbitraryDistributor _distributor
    ) public initializer {
        require(address(this) == _distributor.beneficiary(), "TrueRatingAgencyV2: Invalid distributor beneficiary");
        Ownable.initialize();

        TRU = _TRU;
        stkTRU = _stkTRU;
        distributor = _distributor;

        ratersRewardFactor = 10000;
    }

    /**
     * @dev Set rater reward factor.
     * Reward factor decides what percentage of rewarded TRU is goes to raters
     */
    function setRatersRewardFactor(uint256 newRatersRewardFactor) external onlyOwner {
        require(newRatersRewardFactor <= 10000, "TrueRatingAgencyV2: Raters reward factor cannot be greater than 100%");
        ratersRewardFactor = newRatersRewardFactor;
        emit RatersRewardFactorChanged(newRatersRewardFactor);
    }

    /**
     * @dev Set reward multiplier.
     * Reward multiplier increases reward for TRU stakers
     */
    function setRewardMultiplier(uint256 newRewardMultiplier) external onlyOwner {
        rewardMultiplier = newRewardMultiplier;
        emit RewardMultiplierChanged(newRewardMultiplier);
    }

    /**
     * @dev Get number of NO ratings for a specific account and loan
     * @param id Loan ID
     * @param rater Rater account
     */
    function getNoRate(address id, address rater) public view returns (uint256) {
        return loans[id].ratings[rater][false];
    }

    /**
     * @dev Get number of YES ratings for a specific account and loan
     * @param id Loan ID
     * @param rater Rater account
     */
    function getYesRate(address id, address rater) public view returns (uint256) {
        return loans[id].ratings[rater][true];
    }

    /**
     * @dev Get total NO ratings for a specific loan
     * @param id Loan ID
     */
    function getTotalNoRatings(address id) public view returns (uint256) {
        return loans[id].prediction[false];
    }

    /**
     * @dev Get total YES ratings for a specific loan
     * @param id Loan ID
     */
    function getTotalYesRatings(address id) public view returns (uint256) {
        return loans[id].prediction[true];
    }

    /**
     * @dev Get timestamp at which voting started for a specific loan
     * @param id Loan ID
     */
    function getVotingStart(address id) public view returns (uint256) {
        return loans[id].timestamp;
    }

    /**
     * @dev Get current results for a specific loan
     * @param id Loan ID
     * @return (start_time, total_no, total_yes)
     */
    function getResults(address id)
        external
        override
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (getVotingStart(id), getTotalNoRatings(id), getTotalYesRatings(id));
    }

    /**
     * @dev Internal view to convert values to 8 decimals precision
     * @param input Value to convert to TRU precision
     * @return output TRU amount
     */
    function toTRU(uint256 input) internal pure returns (uint256 output) {
        output = input.div(TOKEN_PRECISION_DIFFERENCE);
    }

    /**
     * @dev Claim TRU rewards for raters
     * - Reward is divided proportionally based on # TRU staked
     * - Only can claim TRU rewards for funded loans
     * - Claimed automatically when a user withdraws stake
     *
     * chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
     * interest = (loan APY * term * principal)
     * R = Total Reward = (interest * chi * rewardFactor)
     * R is distributed to raters based on their proportion of ratings/total_ratings
     *
     * Claimable reward = R x (current time / total time)
     *      * (account TRU staked / total TRU staked) - (amount claimed)
     *
     * @param id Loan ID
     * @param rater Rater account
     */
    function claim(address id, address rater) external override onlyFundedLoans(id) {
        // Update total and rater's TRU rewards for a loan
        uint256 totalReward = 0;
        uint256 ratersReward = 0;
        // TODO remove this special case logic after the 3 old USDC loans mentioned in PR #932 have been fixed.
        // Rewards on these loans were from 1 to 4 due to a bug with decimal conversion fixed in PR #685.
        if (loans[id].reward < 5) {
            uint256 interest = ILoanToken2(id).profit();

            // This method of calculation might be erased in the future
            uint256 decimals;
            if (ILoanToken2(id).version() == 4) {
                decimals = IERC20WithDecimals(address(ILoanToken2(id).token())).decimals();
            } else {
                decimals = IERC20WithDecimals(id).decimals();
            }

            // calculate reward
            // prettier-ignore
            totalReward = toTRU(
                interest.mul(distributor.remaining()).mul(rewardMultiplier).mul(10**18).div(distributor.amount()).div(
                    10**decimals
                )
            );

            ratersReward = totalReward.mul(ratersRewardFactor).div(10000);
            loans[id].reward = ratersReward;
        }

        uint256 claimableRewards = claimable(id, rater);
        // track amount of claimed tokens
        loans[id].claimed[rater] = loans[id].claimed[rater].add(claimableRewards);

        // transfer tokens
        if (totalReward > 0) {
            distributor.distribute(totalReward);
            TRU.safeTransfer(address(stkTRU), totalReward.sub(ratersReward));
        }
        if (claimableRewards > 0) {
            TRU.safeTransfer(rater, claimableRewards);
            emit Claimed(id, rater, claimableRewards);
        }
    }

    /**
     * @dev Get amount claimed for loan ID and rater address
     * @param id Loan ID
     * @param rater Rater address
     * @return Amount claimed for id and address
     */
    function claimed(address id, address rater) external view returns (uint256) {
        return loans[id].claimed[rater];
    }

    /**
     * @dev Get amount claimable for loan ID and rater address
     * @param id Loan ID
     * @param rater Rater address
     * @return Amount claimable for id and address
     */
    function claimable(address id, address rater) public view returns (uint256) {
        if (status(id) < LoanStatus.Running) {
            return 0;
        }

        // calculate how many tokens user can claim
        // claimable = stakedByRater / totalStaked
        uint256 stakedByRater = loans[id].ratings[rater][false].add(loans[id].ratings[rater][true]);
        uint256 totalStaked = loans[id].prediction[false].add(loans[id].prediction[true]);

        // calculate claimable rewards at current time
        uint256 totalClaimable = loans[id].reward.mul(stakedByRater).div(totalStaked);

        return totalClaimable.sub(loans[id].claimed[rater]);
    }

    /**
     * @dev Get status for a specific loan
     * We rely on correct implementation of LoanToken
     * @param id Loan ID
     * @return Status of loan
     */
    function status(address id) public view returns (LoanStatus) {
        Loan storage loan = loans[id];
        // Void loan doesn't exist because timestamp is zero
        if (loan.creator == address(0) && loan.timestamp == 0) {
            return LoanStatus.Void;
        }
        // Retracted loan was cancelled by borrower
        if (loan.creator == address(0) && loan.timestamp != 0) {
            return LoanStatus.Retracted;
        }
        // get internal status
        ILoanToken2.Status loanInternalStatus = ILoanToken2(id).status();

        // Running is Funded || Withdrawn
        if (loanInternalStatus == ILoanToken2.Status.Funded || loanInternalStatus == ILoanToken2.Status.Withdrawn) {
            return LoanStatus.Running;
        }
        // Settled has been paid back in full and past term
        if (loanInternalStatus == ILoanToken2.Status.Settled) {
            return LoanStatus.Settled;
        }
        // Defaulted has not been paid back in full and past term
        if (loanInternalStatus == ILoanToken2.Status.Defaulted) {
            return LoanStatus.Defaulted;
        }
        // Liquidated is same as defaulted and stakers have been liquidated
        if (loanInternalStatus == ILoanToken2.Status.Liquidated) {
            return LoanStatus.Liquidated;
        }
        // otherwise return Pending
        return LoanStatus.Pending;
    }
}
