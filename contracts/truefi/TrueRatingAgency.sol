// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IBurnableERC20} from "../trusttoken/IBurnableERC20.sol";
import {IArbitraryDistributor} from "./interface/IArbitraryDistributor.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITruePool} from "./interface/ITruePool.sol";
import {ITrueRatingAgency} from "./interface/ITrueRatingAgency.sol";
import {Ownable} from "./upgradeability/UpgradeableOwnable.sol";

contract TrueRatingAgency is ITrueRatingAgency, Ownable {
    using SafeMath for uint256;

    enum LoanStatus {Void, Pending, Retracted, Running, Settled, Defaulted}

    struct Loan {
        address creator;
        uint256 timestamp;
        mapping(bool => uint256) prediction;
        mapping(address => mapping(bool => uint256)) votes;
        mapping(address => uint256) claimed;
        uint256 reward;
    }

    mapping(address => bool) public allowedBorrowers;
    mapping(address => Loan) public loans;

    IBurnableERC20 public trustToken;
    IArbitraryDistributor public distributor;

    uint256 private constant TOKEN_PRECISION_DIFFERENCE = 10**10;

    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public lossFactor = 2500;
    uint256 public burnFactor = 2500;

    event Allowed(address indexed who, bool status);
    event LossFactorChanged(uint256 lossFactor);
    event BurnFactorChanged(uint256 burnFactor);
    event LoanSubmitted(address id);
    event LoanRetracted(address id);
    event Voted(address loanToken, address voter, bool choice, uint256 stake);
    event Withdrawn(address loanToken, address voter, uint256 stake, uint256 received, uint256 burned);

    modifier onlyAllowedBorrowers() {
        require(allowedBorrowers[msg.sender], "TrueRatingAgency: Sender is not allowed to submit");
        _;
    }

    modifier onlyCreator(address id) {
        require(loans[id].creator == msg.sender, "TrueRatingAgency: Not sender's loan");
        _;
    }

    modifier onlyNotExistingLoans(address id) {
        require(status(id) == LoanStatus.Void, "TrueRatingAgency: Loan was already created");
        _;
    }

    modifier onlyPendingLoans(address id) {
        require(status(id) == LoanStatus.Pending, "TrueRatingAgency: Loan is not currently pending");
        _;
    }

    modifier onlyNotRunningLoans(address id) {
        require(status(id) != LoanStatus.Running, "TrueRatingAgency: Loan is currently running");
        _;
    }

    modifier onlyFundedLoans(address id) {
        require(status(id) >= LoanStatus.Running, "TrueRatingAgency: Loan was not funded");
        _;
    }

    function initialize(IBurnableERC20 _trustToken, IArbitraryDistributor _distributor) public initializer {
        Ownable.initialize();
        trustToken = _trustToken;
        distributor = _distributor;
    }

    function setLossFactor(uint256 newLossFactor) external onlyOwner {
        lossFactor = newLossFactor;
        emit LossFactorChanged(newLossFactor);
    }

    function setBurnFactor(uint256 newBurnFactor) external onlyOwner {
        burnFactor = newBurnFactor;
        emit BurnFactorChanged(newBurnFactor);
    }

    function getNoVote(address id, address voter) public view returns (uint256) {
        return loans[id].votes[voter][false];
    }

    function getYesVote(address id, address voter) public view returns (uint256) {
        return loans[id].votes[voter][true];
    }

    function getTotalNoVotes(address id) public view returns (uint256) {
        return loans[id].prediction[false];
    }

    function getTotalYesVotes(address id) public view returns (uint256) {
        return loans[id].prediction[true];
    }

    function getVotingStart(address id) public view returns (uint256) {
        return loans[id].timestamp;
    }

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
        return (getVotingStart(id), getTotalNoVotes(id), getTotalYesVotes(id));
    }

    function allow(address who, bool status) external onlyOwner {
        allowedBorrowers[who] = status;
        emit Allowed(who, status);
    }

    function submit(address id) external override onlyAllowedBorrowers onlyNotExistingLoans(id) {
        require(ILoanToken(id).isLoanToken(), "TrueRatingAgency: Only LoanTokens are supported");
        loans[id] = Loan({creator: msg.sender, timestamp: block.timestamp, reward: 0});
        emit LoanSubmitted(id);
    }

    function retract(address id) external override onlyPendingLoans(id) onlyCreator(id) {
        loans[id].creator = address(0);
        loans[id].prediction[true] = 0;
        loans[id].prediction[false] = 0;

        emit LoanRetracted(id);
    }

    function vote(
        address id,
        uint256 stake,
        bool choice
    ) internal {
        require(loans[id].votes[msg.sender][!choice] == 0, "TrueRatingAgency: Cannot vote both yes and no");

        loans[id].prediction[choice] = loans[id].prediction[choice].add(stake);
        loans[id].votes[msg.sender][choice] = loans[id].votes[msg.sender][choice].add(stake);

        require(trustToken.transferFrom(msg.sender, address(this), stake));
        emit Voted(id, msg.sender, choice, stake);
    }

    function yes(address id, uint256 stake) external override onlyPendingLoans(id) {
        vote(id, stake, true);
    }

    function no(address id, uint256 stake) external override onlyPendingLoans(id) {
        vote(id, stake, false);
    }

    function withdraw(address id, uint256 stake) external override onlyNotRunningLoans(id) {
        bool choice = loans[id].votes[msg.sender][true] > 0;
        LoanStatus loanStatus = status(id);

        require(loans[id].votes[msg.sender][choice] >= stake, "TrueRatingAgency: Cannot withdraw more than was staked");

        uint256 amountToTransfer = stake;
        uint256 burned = 0;
        if (loanStatus > LoanStatus.Running) {
            claim(id, msg.sender);
            bool correct = wasPredictionCorrect(id, choice);
            if (correct) {
                amountToTransfer = amountToTransfer.add(bounty(id, !choice).mul(stake).div(loans[id].prediction[choice]));
            } else {
                uint256 lostAmount = amountToTransfer.mul(lossFactor).div(10000);
                amountToTransfer = amountToTransfer.sub(lostAmount);
                burned = lostAmount.mul(burnFactor).div(10000);
                trustToken.burn(burned);
            }
        }

        if (loanStatus == LoanStatus.Pending) {
            loans[id].prediction[choice] = loans[id].prediction[choice].sub(stake);
        }

        loans[id].votes[msg.sender][choice] = loans[id].votes[msg.sender][choice].sub(stake);

        require(trustToken.transfer(msg.sender, amountToTransfer));
        emit Withdrawn(id, msg.sender, stake, amountToTransfer, burned);
    }

    function bounty(address id, bool incorrectChoice) internal view returns (uint256) {
        return loans[id].prediction[incorrectChoice].mul(lossFactor).mul(uint256(10000).sub(burnFactor)).div(10000**2);
    }

    function toTrustToken(uint256 input) internal pure returns (uint256 output) {
        output = input.div(TOKEN_PRECISION_DIFFERENCE);
    }

    modifier calculateTotalReward(address id) {
        if (loans[id].reward == 0) {
            uint256 interest = ILoanToken(id).profit();
            uint256 reward = toTrustToken(interest.mul(distributor.remaining()).div(distributor.amount()));
            loans[id].reward = reward;
            if (loans[id].reward > 0) {
                distributor.distribute(reward);
            }
        }
        _;
    }

    function claim(address id, address voter) public override onlyFundedLoans(id) calculateTotalReward(id) {
        uint256 totalTime = ILoanToken(id).duration();
        uint256 passedTime = block.timestamp.sub(ILoanToken(id).start());
        if (passedTime > totalTime) {
            passedTime = totalTime;
        }
        uint256 stakedByVoter = loans[id].votes[voter][false].add(loans[id].votes[voter][true]);
        uint256 totalStaked = loans[id].prediction[false].add(loans[id].prediction[true]);

        uint256 helper = loans[id].reward.mul(passedTime).mul(stakedByVoter);
        uint256 claimable = helper.div(totalTime).div(totalStaked).sub(loans[id].claimed[voter]);

        loans[id].claimed[voter] = loans[id].claimed[voter].add(claimable);

        if (claimable > 0) {
            require(trustToken.transfer(voter, claimable));
        }
    }

    function wasPredictionCorrect(address id, bool choice) internal view returns (bool) {
        if (status(id) == LoanStatus.Settled && choice) {
            return true;
        }
        if (status(id) == LoanStatus.Defaulted && !choice) {
            return true;
        }
        return false;
    }

    function status(address id) public view returns (LoanStatus) {
        Loan storage loan = loans[id];
        if (loan.creator == address(0) && loan.timestamp == 0) {
            return LoanStatus.Void;
        }
        if (loan.creator == address(0) && loan.timestamp != 0) {
            return LoanStatus.Retracted;
        }
        ILoanToken.Status loanInternalStatus = ILoanToken(id).status();
        if (loanInternalStatus == ILoanToken.Status.Funded || loanInternalStatus == ILoanToken.Status.Withdrawn) {
            return LoanStatus.Running;
        }
        if (loanInternalStatus == ILoanToken.Status.Settled) {
            return LoanStatus.Settled;
        }
        if (loanInternalStatus == ILoanToken.Status.Defaulted) {
            return LoanStatus.Defaulted;
        }
        return LoanStatus.Pending;
    }
}
