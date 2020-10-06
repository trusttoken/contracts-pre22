// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruePool, IERC20} from "./interface/ITruePool.sol";

contract TrueLender is Ownable {
    using SafeMath for uint256;

    struct Application {
        uint256 creationBlock;
        uint256 timestamp;
        address borrower;
        address beneficiary;
        uint256 amount;
        uint256 apy;
        uint256 duration;
        uint256 yeah;
        uint256 nah;
        mapping(address => mapping(bool => uint256)) votes;
    }

    mapping(address => bool) public borrowers;
    mapping(bytes8 => Application) public applications;

    /*immutable*/
    ITruePool public pool;
    /*immutable*/
    IERC20 public currencyToken;
    /*immutable*/
    IERC20 public trustToken;

    // ===== Pool parameters =====
    /**
     * @notice Minimal APY for a loan
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minApy = 1000;
    uint256 public minSize = 1000000 ether;
    uint256 public maxSize = 10000000 ether;
    uint256 public minDuration = 180 days;
    uint256 public maxDuration = 3600 days;
    uint256 public votingPeriod = 7 days;

    event Allowed(address indexed who, bool status);
    event MinApyChanged(uint256 minApy);
    event VotingPeriodChanged(uint256 votingPeriod);
    event SizeLimitsChanged(uint256 minSize, uint256 maxSize);
    event DurationLimitsChanged(uint256 minDuration, uint256 maxDuration);
    event ApplicationSubmitted(bytes8 id, address borrower, address beneficiary, uint256 amount, uint256 apy, uint256 duration);
    event ApplicationRetracted(bytes8 id);

    modifier onlyAllowed() {
        require(borrowers[msg.sender], "TrueLender: sender not allowed borrower");
        _;
    }

    modifier applicationExists(bytes8 id) {
        require(applications[id].creationBlock != 0, "TrueLender: application doesn't exist");
        _;
    }

    modifier onlyDuringVoting(bytes8 id) {
        require(applications[id].timestamp.add(votingPeriod) >= block.timestamp, "TrueLender: can't vote outside the voting period");
        _;
    }

    constructor(ITruePool _pool, IERC20 _trustToken) public {
        pool = _pool;
        currencyToken = _pool.currencyToken();
        currencyToken.approve(address(_pool), uint256(-1));
        trustToken = _trustToken;
    }

    function setSizeLimits(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLender: Maximal loan size is smaller than minimal");
        minSize = min;
        maxSize = max;
        emit SizeLimitsChanged(min, max);
    }

    function setDurationLimits(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLender: Maximal loan duration is smaller than minimal");
        minDuration = min;
        maxDuration = max;
        emit DurationLimitsChanged(min, max);
    }

    function setMinApy(uint256 newMinApy) external onlyOwner {
        minApy = newMinApy;
        emit MinApyChanged(newMinApy);
    }

    function setVotingPeriod(uint256 newVotingPeriod) external onlyOwner {
        votingPeriod = newVotingPeriod;
        emit VotingPeriodChanged(newVotingPeriod);
    }

    function getYeahVote(bytes8 id, address voter) public view returns (uint256) {
        return applications[id].votes[voter][true];
    }

    function getNahVote(bytes8 id, address voter) public view returns (uint256) {
        return applications[id].votes[voter][false];
    }

    function allow(address who, bool status) external onlyOwner {
        borrowers[who] = status;
        emit Allowed(who, status);
    }

    function submit(
        address beneficiary,
        uint256 amount,
        uint256 apy,
        uint256 duration
    ) external onlyAllowed {
        bytes8 id = bytes8(uint64(uint256(keccak256(abi.encodePacked(msg.sender, beneficiary, block.number, amount, apy, duration)))));
        require(applications[id].creationBlock == 0, "TrueLender: Cannot create two same applications in a single block");
        require(amount >= minSize && amount <= maxSize, "TrueLender: Loan size is out of bounds");
        require(duration >= minDuration && duration <= maxDuration, "TrueLender: Loan duration is out of bounds");
        require(apy >= minApy, "TrueLender: APY is below minimum");

        applications[id] = Application({
            creationBlock: block.number,
            timestamp: block.timestamp,
            borrower: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            apy: apy,
            duration: duration,
            yeah: 0,
            nah: 0
        });

        emit ApplicationSubmitted(id, msg.sender, beneficiary, amount, apy, duration);
    }

    function retract(bytes8 id) external applicationExists(id) {
        require(applications[id].borrower == msg.sender, "TrueLender: not retractor's application");
        delete applications[id];

        emit ApplicationRetracted(id);
    }

    function vote(
        bytes8 id,
        uint256 stake,
        bool choice
    ) internal {
        require(applications[id].votes[msg.sender][!choice] == 0, "TrueLender: can't vote both yeah and nah");
        applications[id].votes[msg.sender][choice] = applications[id].votes[msg.sender][choice].add(stake);
        require(trustToken.transferFrom(msg.sender, address(this), stake));
    }

    function yeah(bytes8 id, uint256 stake) external applicationExists(id) onlyDuringVoting(id) {
        applications[id].yeah = applications[id].yeah.add(stake);
        vote(id, stake, true);
    }

    function nah(bytes8 id, uint256 stake) external applicationExists(id) onlyDuringVoting(id) {
        applications[id].nah = applications[id].nah.add(stake);
        vote(id, stake, false);
    }
}
