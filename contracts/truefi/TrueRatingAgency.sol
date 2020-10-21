// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITruePool} from "./interface/ITruePool.sol";
import {ITrueRatingAgency} from "./interface/ITrueRatingAgency.sol";

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

    IERC20 public trustToken;

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

    constructor(IERC20 _trustToken) public {
        trustToken = _trustToken;
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
        require(loans[id].votes[msg.sender][choice] >= stake, "TrueRatingAgency: Cannot withdraw more than was staked");
        loans[id].votes[msg.sender][choice] = loans[id].votes[msg.sender][choice].sub(stake);
        if (status(id) == LoanStatus.Pending) {
            loans[id].prediction[choice] = loans[id].prediction[choice].sub(stake);
        }
        uint256 amountToTransfer = stake;
        // if (status(id) == LoanStatus.Settled) {
        //     add bonus/penalty to payout amount depending on yes/no choice
        // }
        // if (status(id) == LoanStatus.Defaulted) {
        //     add bonus/penalty to payout amount depending on no/yes choice
        // }
        require(trustToken.transfer(msg.sender, amountToTransfer));
    }

    function status(address id) public view returns (LoanStatus) {
        Loan storage loan = loans[id];
        if (loan.creator == address(0) && loan.timestamp == 0) {
            return LoanStatus.Void;
        }
        if (loan.creator == address(0) && loan.timestamp != 0) {
            return LoanStatus.Retracted;
        }
        // if(loan was funded and it is still ongoing) {
        //     return LoanStatus.Running; <- will block all voting-related actions
        // }
        // if(loan was funded and successfully repaid) {
        //     return LoanStatus.Settled; <- will allow withdrawing stake, but with losers/winners modifiers
        // }
        // if(loan was funded and defaulted) {
        //     return LoanStatus.Defaulted; <- will allow withdrawing stake, but with losers/winners modifiers
        // }
        return LoanStatus.Pending;
    }
}
