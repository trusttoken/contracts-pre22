// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {IBurnableERC20} from "../trusttoken/interface/IBurnableERC20.sol";
import {IVoteTokenWithERC20} from "../governance/interface/IVoteToken.sol";

import {Ownable} from "./common/UpgradeableOwnable.sol";
import {IArbitraryDistributor} from "./interface/IArbitraryDistributor.sol";
import {ILoanFactory} from "./interface/ILoanFactory.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {ITrueRatingAgencyV2} from "./interface/ITrueRatingAgencyV2.sol";

/**
 * @title TrueRatingAgencyV2
 * @dev Credit prediction market for LoanTokens
 *
 * TrueFi uses use a prediction market to signal how risky a loan is.
 * The Credit Prediction Market estimates the likelihood of a loan defaulting.
 * Any stkTRU holder can rate YES or NO and stake TRU as collateral on their rate.
 * If a loan is funded, TRU is rewarded as incentive for participation
 * Rating stkTRU in the prediction market allows raters to earn and claim TRU
 * incentive when the loan is passed
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

    mapping(address => bool) public allowedSubmitters;
    mapping(address => Loan) public loans;

    IBurnableERC20 public TRU;
    IVoteTokenWithERC20 public stkTRU;
    IArbitraryDistributor public distributor;
    ILoanFactory public factory;

    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public ratersRewardFactor;

    // reward multiplier for raters
    uint256 public rewardMultiplier;

    // are submissions paused?
    bool public submissionPauseStatus;

    // ======= STORAGE DECLARATION END ============

    event Allowed(address indexed who, bool status);
    event RatersRewardFactorChanged(uint256 ratersRewardFactor);
    event LoanSubmitted(address id);
    event LoanRetracted(address id);
    event Rated(address loanToken, address rater, bool choice, uint256 stake);
    event Withdrawn(address loanToken, address rater, uint256 stake, uint256 received, uint256 burned);
    event RewardMultiplierChanged(uint256 newRewardMultiplier);
    event Claimed(address loanToken, address rater, uint256 claimedReward);
    event SubmissionPauseStatusChanged(bool status);

    /**
     * @dev Only whitelisted borrowers can submit for credit ratings
     */
    modifier onlyAllowedSubmitters() {
        require(allowedSubmitters[msg.sender], "TrueRatingAgencyV2: Sender is not allowed to submit");
        _;
    }

    /**
     * @dev Only loan submitter can perform certain actions
     */
    modifier onlyCreator(address id) {
        require(loans[id].creator == msg.sender, "TrueRatingAgencyV2: Not sender's loan");
        _;
    }

    /**
     * @dev Cannot submit the same loan multiple times
     */
    modifier onlyNotExistingLoans(address id) {
        require(status(id) == LoanStatus.Void, "TrueRatingAgencyV2: Loan was already created");
        _;
    }

    /**
     * @dev Only loans in Pending state
     */
    modifier onlyPendingLoans(address id) {
        require(status(id) == LoanStatus.Pending, "TrueRatingAgencyV2: Loan is not currently pending");
        _;
    }

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
     * @param _factory Factory contract for deploying tokens
     */
    function initialize(
        IBurnableERC20 _TRU,
        IVoteTokenWithERC20 _stkTRU,
        IArbitraryDistributor _distributor,
        ILoanFactory _factory
    ) public initializer {
        require(address(this) == _distributor.beneficiary(), "TrueRatingAgencyV2: Invalid distributor beneficiary");
        Ownable.initialize();

        TRU = _TRU;
        stkTRU = _stkTRU;
        distributor = _distributor;
        factory = _factory;

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
     * @dev Whitelist borrowers to submit loans for rating
     * @param who Account to whitelist
     * @param status Flag to whitelist accounts
     */
    function allow(address who, bool status) external onlyOwner {
        allowedSubmitters[who] = status;
        emit Allowed(who, status);
    }

    /**
     * @dev Pause submitting loans for rating
     * @param status Flag of the status
     */
    function pauseSubmissions(bool status) public onlyOwner {
        submissionPauseStatus = status;
        emit SubmissionPauseStatusChanged(status);
    }

    /**
     * @dev Submit a loan for rating
     * Cannot submit the same loan twice
     * @param id Loan ID
     */
    function submit(address id) external override onlyAllowedSubmitters onlyNotExistingLoans(id) {
        require(!submissionPauseStatus, "TrueRatingAgencyV2: New submissions are paused");
        require(ILoanToken(id).borrower() == msg.sender, "TrueRatingAgencyV2: Sender is not borrower");
        require(factory.isLoanToken(id), "TrueRatingAgencyV2: Only LoanTokens created via LoanFactory are supported");
        loans[id] = Loan({creator: msg.sender, timestamp: block.timestamp, blockNumber: block.number, reward: 0});
        emit LoanSubmitted(id);
    }

    /**
     * @dev Remove Loan from rating agency
     * Can only be retracted by loan creator
     * @param id Loan ID
     */
    function retract(address id) external override onlyPendingLoans(id) onlyCreator(id) {
        loans[id].creator = address(0);
        loans[id].prediction[true] = 0;
        loans[id].prediction[false] = 0;

        emit LoanRetracted(id);
    }

    /**
     * @dev Rate on a loan by staking TRU
     * @param id Loan ID
     * @param choice Rater choice. false = NO, true = YES
     */
    function rate(address id, bool choice) internal {
        uint256 stake = stkTRU.getPriorVotes(msg.sender, loans[id].blockNumber);
        require(stake > 0, "TrueRatingAgencyV2: Cannot rate with empty balance");

        resetCastRatings(id);

        loans[id].prediction[choice] = loans[id].prediction[choice].add(stake);
        loans[id].ratings[msg.sender][choice] = loans[id].ratings[msg.sender][choice].add(stake);

        emit Rated(id, msg.sender, choice, stake);
    }

    function _resetCastRatings(address id, bool choice) internal {
        loans[id].prediction[choice] = loans[id].prediction[choice].sub(loans[id].ratings[msg.sender][choice]);
        loans[id].ratings[msg.sender][choice] = 0;
    }

    /**
     * @dev Cancel ratings of msg.sender
     */
    function resetCastRatings(address id) public onlyPendingLoans(id) {
        if (getYesRate(id, msg.sender) > 0) {
            _resetCastRatings(id, true);
        } else if (getNoRate(id, msg.sender) > 0) {
            _resetCastRatings(id, false);
        }
    }

    /**
     * @dev Rate YES on a loan by staking TRU
     * @param id Loan ID
     */
    function yes(address id) external override onlyPendingLoans(id) {
        rate(id, true);
    }

    /**
     * @dev Rate NO on a loan by staking TRU
     * @param id Loan ID
     */
    function no(address id) external override onlyPendingLoans(id) {
        rate(id, false);
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
     * @dev Update total TRU reward for a Loan
     * Reward is divided proportionally based on # TRU staked
     * chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
     * interest = (loan APY * term * principal)
     * R = Total Reward = (interest * chi * rewardFactor)
     * @param id Loan ID
     */
    modifier calculateTotalReward(address id) {
        if (loans[id].reward == 0) {
            uint256 interest = ILoanToken(id).profit();

            // calculate reward
            // prettier-ignore
            uint256 totalReward = toTRU(
                interest
                    .mul(distributor.remaining())
                    .mul(rewardMultiplier)
                    .div(distributor.amount())
            );

            uint256 ratersReward = totalReward.mul(ratersRewardFactor).div(10000);
            loans[id].reward = ratersReward;
            if (loans[id].reward > 0) {
                distributor.distribute(totalReward);
                TRU.transfer(address(stkTRU), totalReward.sub(ratersReward));
            }
        }
        _;
    }

    /**
     * @dev Claim TRU rewards for raters
     * - Only can claim TRU rewards for funded loans
     * - Claimed automatically when a user withdraws stake
     *
     * chi = (TRU remaining in distributor) / (Total TRU allocated for distribution)
     * interest = (loan APY * term * principal)
     * R = Total Reward = (interest * chi)
     * R is distributed to raters based on their proportion of ratings/total_ratings
     *
     * Claimable reward = R x (current time / total time)
     *      * (account TRU staked / total TRU staked) - (amount claimed)
     *
     * @param id Loan ID
     * @param rater Rater account
     */
    function claim(address id, address rater) external override onlyFundedLoans(id) calculateTotalReward(id) {
        uint256 claimableRewards = claimable(id, rater);

        if (claimableRewards > 0) {
            // track amount of claimed tokens
            loans[id].claimed[rater] = loans[id].claimed[rater].add(claimableRewards);
            // transfer tokens
            require(TRU.transfer(rater, claimableRewards));
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
        if (totalClaimable < loans[id].claimed[rater]) {
            // This happens only in one case: rater withdrew part of stake after loan has ended and claimed all possible rewards
            return 0;
        }
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
        ILoanToken.Status loanInternalStatus = ILoanToken(id).status();

        // Running is Funded || Withdrawn
        if (loanInternalStatus == ILoanToken.Status.Funded || loanInternalStatus == ILoanToken.Status.Withdrawn) {
            return LoanStatus.Running;
        }
        // Settled has been paid back in full and past term
        if (loanInternalStatus == ILoanToken.Status.Settled) {
            return LoanStatus.Settled;
        }
        // Defaulted has not been paid back in full and past term
        if (loanInternalStatus == ILoanToken.Status.Defaulted) {
            return LoanStatus.Defaulted;
        }
        // Liquidated is same as defaulted and stakers have been liquidated
        if (loanInternalStatus == ILoanToken.Status.Liquidated) {
            return LoanStatus.Liquidated;
        }
        // otherwise return Pending
        return LoanStatus.Pending;
    }
}
