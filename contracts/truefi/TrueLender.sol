// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {ITrueRatingAgency} from "./interface/ITrueRatingAgency.sol";
import {Ownable} from "./upgradeability/UpgradeableOwnable.sol";

/**
 * @title TrueLender
 * @dev TrueFi lending pool
 * TODO: More docs
 */
contract TrueLender is ITrueLender, Ownable {
    using SafeMath for uint256;

    mapping(address => bool) public allowedBorrowers;
    ILoanToken[] _loans;

    ITrueFiPool public pool;
    IERC20 public currencyToken;
    ITrueRatingAgency public ratingAgency;

    uint256 private constant TOKEN_PRECISION_DIFFERENCE = 10**10;

    // ===== Pool parameters =====
    /**
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */

    // bound on APY
    uint256 public minApy = 1000;
    uint256 public maxApy = 3000;

    // How many votes in predction market
    uint256 public participationFactor = 10000;

    // How much worse is it to lose $1 TUSD than it is to gain $1 TUSD
    uint256 public riskAversion = 15000;

    // bound on min & max loan sizes
    uint256 public minSize = 1000000 ether;
    uint256 public maxSize = 10000000 ether;

    // bound on min & max loan terms
    uint256 public minTerm = 180 days;
    uint256 public maxTerm = 3600 days;

    // minimum prediction market voting period
    uint256 public votingPeriod = 7 days;

    event Allowed(address indexed who, bool status);
    event ApyLimitsChanged(uint256 minApy, uint256 maxApy);
    event ParticipationFactorChanged(uint256 participationFactor);
    event RiskAversionChanged(uint256 participationFactor);
    event VotingPeriodChanged(uint256 votingPeriod);
    event SizeLimitsChanged(uint256 minSize, uint256 maxSize);
    event DurationLimitsChanged(uint256 minTerm, uint256 maxTerm);
    event Funded(address indexed loanToken, uint256 amount);
    event Reclaimed(address indexed loanToken, uint256 amount);

    modifier onlyAllowedBorrowers() {
        require(allowedBorrowers[msg.sender], "TrueLender: Sender is not allowed to borrow");
        _;
    }

    modifier onlyPool() {
        require(msg.sender == address(pool), "TrueLender: Sender is not a pool");
        _;
    }

    function initialize(ITrueFiPool _pool, ITrueRatingAgency _ratingAgency) public initializer {
        Ownable.initialize();

        pool = _pool;
        currencyToken = _pool.currencyToken();
        currencyToken.approve(address(_pool), uint256(-1));
        ratingAgency = _ratingAgency;
    }

    function setSizeLimits(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLender: Maximal loan size is smaller than minimal");
        minSize = min;
        maxSize = max;
        emit SizeLimitsChanged(min, max);
    }

    function setDurationLimits(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLender: Maximal loan duration is smaller than minimal");
        minTerm = min;
        maxTerm = max;
        emit DurationLimitsChanged(min, max);
    }

    function setApyLimits(uint256 newMinApy, uint256 newMaxApy) external onlyOwner {
        require(newMaxApy >= newMinApy, "TrueLender: Maximal APY is smaller than minimal");
        minApy = newMinApy;
        maxApy = newMaxApy;
        emit ApyLimitsChanged(newMinApy, newMaxApy);
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

    function loans() public view returns (ILoanToken[] memory result) {
        result = _loans;
    }

    function allow(address who, bool status) external onlyOwner {
        allowedBorrowers[who] = status;
        emit Allowed(who, status);
    }

    function fund(ILoanToken loanToken) external onlyAllowedBorrowers {
        require(loanToken.isLoanToken(), "TrueLender: Only LoanTokens can be funded");

        (uint256 amount, uint256 apy, uint256 duration) = loanToken.getParameters();
        uint256 receivedAmount = loanToken.receivedAmount();
        (uint256 start, uint256 no, uint256 yes) = ratingAgency.getResults(address(loanToken));

        require(loanSizeWithinBounds(amount), "TrueLender: Loan size is out of bounds");
        require(loanDurationWithinBounds(duration), "TrueLender: Loan duration is out of bounds");
        require(loanIsAttractiveEnough(apy), "TrueLender: APY is out of bounds");
        require(votingLastedLongEnough(start), "TrueLender: Voting time is below minimum");
        require(votesThresholdReached(amount, yes), "TrueLender: Not enough votes given for the loan");
        require(loanIsCredible(apy, duration, yes, no), "TrueLender: Loan risk is too high");

        pool.borrow(amount, receivedAmount);
        currencyToken.approve(address(loanToken), receivedAmount);
        loanToken.fund();
        _loans.push(loanToken);
        emit Funded(address(loanToken), receivedAmount);
    }

    // loop through loan tokens and add theoretical value
    // LoanTokens calculate value
    // TODO: Set max number of loans in parameters to avoid looping out of gas
    function value() external override view returns (uint256) {
        uint256 totalValue;
        for (uint256 index = 0; index < _loans.length; index++) {
            totalValue = totalValue.add(_loans[index].value(_loans[index].balanceOf(address(this))));
        }
        return totalValue;
    }

    // provides lending contract with possibility of burning tokens & getting funds
    function reclaim(ILoanToken loanToken) external onlyOwner {
        require(loanToken.isLoanToken(), "TrueLender: Only LoanTokens can be used to reclaimed");
        require(
            loanToken.status() == ILoanToken.Status.Settled || loanToken.status() == ILoanToken.Status.Defaulted,
            "TrueLender: LoanToken is not closed yet"
        );

        // call redeem function on LoanToken
        uint256 balanceBefore = currencyToken.balanceOf(address(this));
        loanToken.redeem(loanToken.balanceOf(address(this)));
        uint256 balanceAfter = currencyToken.balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        uint256 fundsReclaimed = balanceAfter.sub(balanceBefore);
        pool.repay(fundsReclaimed);

        // remove loan from loan array
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loanToken) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();
                break;
            }
        }

        emit Reclaimed(address(loanToken), fundsReclaimed);
    }

    /**
     * Withdraw a basket of tokens held by the pool
     * Loop through recipient's share of LoanTokens and calculate versus total
     * per loan.
     */
    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external override onlyPool {
        for (uint256 index = 0; index < _loans.length; index++) {
            _loans[index].transfer(recipient, numerator.mul(_loans[index].balanceOf(address(this))).div(denominator));
        }
    }

    function loanIsAttractiveEnough(uint256 apy) public view returns (bool) {
        return apy >= minApy && apy <= maxApy;
    }

    function votingLastedLongEnough(uint256 start) public view returns (bool) {
        return start.add(votingPeriod) <= block.timestamp;
    }

    function loanSizeWithinBounds(uint256 amount) public view returns (bool) {
        return amount >= minSize && amount <= maxSize;
    }

    function loanDurationWithinBounds(uint256 duration) public view returns (bool) {
        return duration >= minTerm && duration <= maxTerm;
    }

    // minimum absolute value of yes votes, rather than ratio of yes to no
    function votesThresholdReached(uint256 amount, uint256 yesVotes) public view returns (bool) {
        return amount.mul(participationFactor) <= yesVotes.mul(10000).mul(TOKEN_PRECISION_DIFFERENCE);
    }

    // use APY and duration of loan to get expected 
    // expected value = profit - (default_loss * (no / yes))
    // riskAversion = 10,000 => expected value of 1
    function loanIsCredible(
        uint256 apy,
        uint256 duration,
        uint256 yesVotes,
        uint256 noVotes
    ) public view returns (bool) {
        return apy.mul(duration).mul(yesVotes).div(360 days) >= noVotes.mul(riskAversion);
    }
}
