// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITruePool, IERC20} from "./interface/ITruePool.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";
import {TrueRatingAgency} from "./TrueRatingAgency.sol";

contract TrueLender is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) public allowedBorrowers;

    ITruePool public pool;
    IERC20 public currencyToken;
    TrueRatingAgency public predictionMarket;

    uint256 private constant TOKEN_PRECISION_DIFFERENCE = 10**10;

    // ===== Pool parameters =====
    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minApy = 1000;
    uint256 public participationFactor = 10000;
    uint256 public riskAversion = 15000;

    uint256 public minSize = 1000000 ether;
    uint256 public maxSize = 10000000 ether;
    uint256 public minDuration = 180 days;
    uint256 public maxDuration = 3600 days;
    uint256 public votingPeriod = 7 days;

    event Allowed(address indexed who, bool status);
    event MinApyChanged(uint256 minApy);
    event ParticipationFactorChanged(uint256 participationFactor);
    event RiskAversionChanged(uint256 participationFactor);
    event VotingPeriodChanged(uint256 votingPeriod);
    event SizeLimitsChanged(uint256 minSize, uint256 maxSize);
    event DurationLimitsChanged(uint256 minDuration, uint256 maxDuration);

    modifier onlyAllowedBorrowers() {
        require(allowedBorrowers[msg.sender], "TrueLender: sender not allowed borrower");
        _;
    }

    constructor(ITruePool _pool, TrueRatingAgency _predictionMarket) public {
        pool = _pool;
        currencyToken = _pool.currencyToken();
        currencyToken.approve(address(_pool), uint256(-1));
        predictionMarket = _predictionMarket;
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

    function setParticipationFactor(uint256 newParticipationFactor) external onlyOwner {
        participationFactor = newParticipationFactor;
        emit ParticipationFactorChanged(newParticipationFactor);
    }

    function setRiskAversion(uint256 newRiskAversion) external onlyOwner {
        riskAversion = newRiskAversion;
        emit RiskAversionChanged(newRiskAversion);
    }

    function allow(address who, bool status) external onlyOwner {
        allowedBorrowers[who] = status;
        emit Allowed(who, status);
    }

    function fund(ILoanToken loanToken) external onlyAllowedBorrowers {
        require(loanToken.isLoanToken(), "TrueLender: Only LoanTokens can be funded");

        (uint256 amount, uint256 apy, uint256 duration) = loanToken.getParameters();
        (uint256 start, uint256 no, uint256 yes) = predictionMarket.getResults(address(loanToken));

        require(loanSizeIsInBounds(amount), "TrueLender: Loan size is out of bounds");
        require(loanDurationIsInBounds(duration), "TrueLender: Loan duration is out of bounds");
        require(loanIsAttractiveEnough(apy), "TrueLender: APY is below minimum");
        require(votingLastedLongEnough(start), "TrueLender: Voting time is below minimum");
        require(votesTresholdReached(amount, yes), "TrueLender: Not enough votes given for the loan");
        require(loanIsCredible(apy, duration, yes, no), "TrueLender: Loan risk is too high to approve");

        currencyToken.approve(address(loanToken), loanToken.amount());
        pool.borrow(loanToken.amount());
        loanToken.fund();
    }

    function loanIsAttractiveEnough(uint256 apy) public view returns (bool) {
        return apy >= minApy;
    }

    function votingLastedLongEnough(uint256 start) public view returns (bool) {
        return start.add(votingPeriod) <= block.timestamp;
    }

    function loanSizeIsInBounds(uint256 amount) public view returns (bool) {
        return amount >= minSize && amount <= maxSize;
    }

    function loanDurationIsInBounds(uint256 duration) public view returns (bool) {
        return duration >= minDuration && duration <= maxDuration;
    }

    function votesTresholdReached(uint256 amount, uint256 yesVotes) public view returns (bool) {
        return amount.mul(participationFactor) <= yesVotes.mul(10000).mul(TOKEN_PRECISION_DIFFERENCE);
    }

    function loanIsCredible(
        uint256 apy,
        uint256 duration,
        uint256 yesVotes,
        uint256 noVotes
    ) public view returns (bool) {
        return apy.mul(duration).mul(yesVotes).div(360 days) >= noVotes.mul(riskAversion);
    }
}
