// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiPool, IERC20} from "./ITrueFiPool.sol";

contract TrueLendingPool is Ownable {
    using SafeMath for uint256;

    enum ApplicationStatus {VOTING, APPROVED, REJECTED}

    struct Vote {
        uint256 stake;
        bool approves;
        address who;
    }

    struct Application {
        uint256 creationBlock;
        uint256 timestamp;
        address creator;
        address receiver;
        uint256 amount;
        uint256 apy;
        uint256 duration;
        uint256 votedFor;
        uint256 votedAgainst;
        mapping(address => uint256) votePointer;
    }

    mapping(address => bool) public whitelisted;
    /*immutable*/
    ITrueFiPool public pool;
    /*immutable*/
    IERC20 public token;
    mapping(bytes8 => Application) public applications;
    mapping(bytes8 => Vote[]) votes;

    // ===== Pool parameters =====
    uint256 public minLoanSize = 1000000 ether;
    uint256 public maxLoanSize = 10000000 ether;
    /**
     * @notice Minimal APY for a loan
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minApy = 1000;
    /**
     * @notice Minimum TRU voted YES required to approve a loan:
     * Loan size in TUSD * factor -> initial factor is 0.7
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minLoanApprovalFactor = 7000;
    /**
     * @notice Minimum ratio YES votes required to pass
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minLoanApprovalVoteRatio = 7000;
    /**
     * @notice How many TRU tokens are burnt for yes-voters in case loan defaults
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public burnFactor = 8000;
    /**
     * @notice How long can TRU stakers vote for/against vote
     * since application was submitted
     */
    uint256 public voteDuration = 7 days;

    event Whitelisted(address indexed who, bool status);
    event LoanBoundsChanged(uint256 minLoanSize, uint256 maxLoanSize);
    event MinApyChanged(uint256 minApy);
    event LoanApprovalConditionsChanged(uint256 minLoanApprovalFactor, uint256 minLoanApprovalVoteRatio);
    event BurnFactorChanged(uint256 burnFactor);
    event VoteDurationChanged(uint256 newVoteDuration);
    event NewApplication(bytes8 id, address creator, address receiver, uint256 amount, uint256 apy, uint256 duration);
    event ApplicationRemoved(bytes32 id);

    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender], "TrueLendingPool: sender not whitelisted");
        _;
    }

    modifier applicationExists(bytes8 id) {
        require(applications[id].creationBlock != 0, "TrueLendingPool: application doesn't exist");
        _;
    }

    modifier onlyDuringVoting(bytes8 id) {
        require(getApplicationStatus(id) == ApplicationStatus.VOTING, "TrueLendingPool: Voting period has ended");
        _;
    }

    constructor(ITrueFiPool _pool) public {
        pool = _pool;
        token = _pool.token();
        token.approve(address(_pool), uint256(-1));
    }

    function setLoanBounds(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLendingPool: Maximal loan size is smaller than minimal");
        minLoanSize = min;
        maxLoanSize = max;
        emit LoanBoundsChanged(min, max);
    }

    function setMinApy(uint256 newMinApy) external onlyOwner {
        minApy = newMinApy;
        emit MinApyChanged(newMinApy);
    }

    function setLoanApprovalConditions(uint256 newMinLoanApprovalFactor, uint256 newMinLoanApprovalVoteRatio) external onlyOwner {
        require(newMinLoanApprovalFactor <= 10000, "TrueLendingPool: MinLoanApprovalFactor exceeds 100%");
        require(newMinLoanApprovalVoteRatio <= 10000, "TrueLendingPool: MinLoanApprovalVoteRatio exceeds 100%");

        minLoanApprovalFactor = newMinLoanApprovalFactor;
        minLoanApprovalVoteRatio = newMinLoanApprovalVoteRatio;
        emit LoanApprovalConditionsChanged(newMinLoanApprovalFactor, newMinLoanApprovalVoteRatio);
    }

    function setBurnFactor(uint256 newBurnFactor) external onlyOwner {
        burnFactor = newBurnFactor;
        emit BurnFactorChanged(newBurnFactor);
    }

    function setVoteDuration(uint256 newVoteDuration) external onlyOwner {
        voteDuration = newVoteDuration;
        emit VoteDurationChanged(newVoteDuration);
    }

    function whitelistForLoan(address who, bool status) external onlyOwner {
        whitelisted[who] = status;
        emit Whitelisted(who, status);
    }

    function createLoanApplication(
        address receiver,
        uint256 amount,
        uint256 apy,
        uint256 duration
    ) external onlyWhitelisted {
        require(amount >= minLoanSize && amount <= maxLoanSize, "TrueLendingPool: Loan size is out of bounds");
        require(apy >= minApy, "TrueLendingPool: APY is below minimum");

        bytes8 id = bytes8(uint64(uint256(keccak256(abi.encodePacked(msg.sender, receiver, block.number, amount, apy, duration)))));
        require(applications[id].creationBlock == 0, "TrueLendingPool: Cannot create two same applications in a single block");

        applications[id] = Application({
            creationBlock: block.number,
            timestamp: block.timestamp,
            creator: msg.sender,
            receiver: receiver,
            amount: amount,
            apy: apy,
            duration: duration,
            votedFor: 0,
            votedAgainst: 0
        });
        emit NewApplication(id, msg.sender, receiver, amount, apy, duration);
    }

    function removeLoanApplication(bytes8 id) external applicationExists(id) {
        require(applications[id].creator == msg.sender, "TrueLendingPool: not application's creator");
        delete applications[id];

        emit ApplicationRemoved(id);
    }

    function yeah(bytes8 id, uint256 stake) external onlyDuringVoting(id) {
        require(token.transferFrom(msg.sender, address(this), stake));

        if (votes[id][applications[id].votePointer[msg.sender]].who == msg.sender) {
            Vote storage vote = votes[id][applications[id].votePointer[msg.sender]];
            require(vote.approves, "TrueLendingPool: This application has already been voted against");
            vote.stake = vote.stake.add(stake);
        } else {
            applications[id].votePointer[msg.sender] = votes[id].length;
            votes[id].push(Vote({stake: stake, approves: true, who: msg.sender}));
        }
        applications[id].votedFor = applications[id].votedFor.add(stake);
    }

    function nah(bytes8 id, uint256 stake) external onlyDuringVoting(id) {
        require(token.transferFrom(msg.sender, address(this), stake));

        if (votes[id][applications[id].votePointer[msg.sender]].who == msg.sender) {
            Vote storage vote = votes[id][applications[id].votePointer[msg.sender]];
            require(!vote.approves, "TrueLendingPool: This application has already been voted for");
            vote.stake = vote.stake.add(stake);
        } else {
            applications[id].votePointer[msg.sender] = votes[id].length;
            votes[id].push(Vote({stake: stake, approves: false, who: msg.sender}));
        }
        applications[id].votedAgainst = applications[id].votedAgainst.add(stake);
    }

    function meh() external {
        // does nothing
    }

    function getApplicationStatus(bytes8 id) public view applicationExists(id) returns (ApplicationStatus) {
        if (applications[id].timestamp.add(voteDuration) < block.timestamp) {
            return ApplicationStatus.VOTING;
        }
        return ApplicationStatus.APPROVED;
    }
}
