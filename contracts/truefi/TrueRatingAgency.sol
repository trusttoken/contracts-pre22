// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITruePool} from "./interface/ITruePool.sol";
import {ITrueRatingAgency} from "./interface/ITrueRatingAgency.sol";
import {TrustToken} from "../trusttoken/TrustToken.sol";

contract TrueRatingAgency is ITrueRatingAgency, Ownable {
    using SafeMath for uint256;

    enum LoanStatus {Void, Pending, Retracted, Running, Settled, Defaulted}

    struct Loan {
        address creator;
        uint256 timestamp;
        mapping(bool => uint256) prediction;
        mapping(address => mapping(bool => uint256)) votes;
    }

    mapping(address => Loan) public loans;

    TrustToken public trustToken;

    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public lossFactor = 2500;
    uint256 public burnFactor = 2500;

    event LossFactorChanged(uint256 participationFactor);
    event BurnFactorChanged(uint256 votingPeriod);
    event LoanSubmitted(address id);
    event LoanRetracted(address id);

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

    constructor(TrustToken _trustToken) public {
        trustToken = _trustToken;
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

    function submit(address id) external override onlyNotExistingLoans(id) {
        require(ILoanToken(id).isLoanToken(), "TrueRatingAgency: Only LoanTokens are supported");
        loans[id] = Loan({creator: msg.sender, timestamp: block.timestamp});
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
        require(loanStatus != LoanStatus.Running, "TrueRatingAgency: Cannot withdraw when loan is ongoing");

        loans[id].votes[msg.sender][choice] = loans[id].votes[msg.sender][choice].sub(stake);
        if (loanStatus == LoanStatus.Pending) {
            loans[id].prediction[choice] = loans[id].prediction[choice].sub(stake);
        }

        uint256 amountToTransfer = stake;
        if (loanStatus > LoanStatus.Running) {
            bool correct = wasPredictionCorrect(id, choice);
            if (correct) {
                // Take bounty from losers
                amountToTransfer = amountToTransfer.add(bounty(id, !choice).mul(amountToTransfer).div(loans[id].prediction[choice]));
            } else {
                // Take what is left
                uint256 lostAmount = amountToTransfer.mul(lossFactor).div(10000);
                amountToTransfer = amountToTransfer.sub(lostAmount);
                trustToken.burn(lostAmount.mul(burnFactor).div(10000));
            }
        }
        require(trustToken.transfer(msg.sender, amountToTransfer));
    }

    function bounty(address id, bool incorrectChoice) internal view returns (uint256) {
        return loans[id].prediction[incorrectChoice].mul(lossFactor).mul(uint256(10000).sub(burnFactor)).div(10000**2);
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
