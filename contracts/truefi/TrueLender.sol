// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Ownable} from "./common/UpgradeableOwnable.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {ITrueRatingAgency} from "./interface/ITrueRatingAgency.sol";
import {IStakingPool} from "./interface/IStakingPool.sol";

/**
 * @title TrueLender v1.0
 * @dev TrueFi Lending Strategy
 * This contract implements the lending strategy for the TrueFi pool
 * The strategy takes into account several parameters and consumes
 * information from the prediction market in order to approve loans
 *
 * This strategy is conservative to avoid defaults.
 * See: https://github.com/trusttoken/truefi-spec
 *
 * 1. Only approve loans which have the following inherent properties:
 * - minAPY <= loanAPY <= maxAPY
 * - minSize <= loanSize <= maxSize
 * - minTerm <= loanTerm <= maxTerm
 *
 * 2. Only approve loans which have been rated in the prediction market under the conditions:
 * - timeInMarket >= votingPeriod
 * - stakedTRU > (participationFactor * loanSize)
 * - 1 < ( interest * P(loan_repaid) - (loanSize * riskAversion * P(loan_defaults))
 *
 * Once a loan meets these requirements, fund() can be called to transfer
 * funds from the pool to the LoanToken contract
 */
contract TrueLender is ITrueLender, Ownable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => bool) public allowedBorrowers;
    ILoanToken[] _loans;

    ITrueFiPool public pool;
    IERC20 public currencyToken;
    ITrueRatingAgency public ratingAgency;

    uint256 private constant TOKEN_PRECISION_DIFFERENCE = 10**10;

    // ===== Pool parameters =====

    // bound on APY
    uint256 public minApy;
    uint256 public maxApy;

    // How many votes in predction market
    uint256 public participationFactor;

    // How much worse is it to lose $1 TUSD than it is to gain $1 TUSD
    uint256 public riskAversion;

    // bound on min & max loan sizes
    uint256 public minSize;
    uint256 public maxSize;

    // bound on min & max loan terms
    uint256 public minTerm;
    uint256 public maxTerm;

    // minimum prediction market voting period
    uint256 public votingPeriod;

    // maximum amount of loans lender can handle at once
    uint256 public maxLoans;

    // implemented as an ERC20, will change after implementing stkPool
    IStakingPool public stakingPool;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a borrower's whitelist status changes
     * @param who Address for which whitelist status has changed
     * @param status New whitelist status
     */
    event Allowed(address indexed who, bool status);

    /**
     * @dev Emitted when APY bounds have changed
     * @param minApy New minimum APY
     * @param maxApy New maximum APY
     */
    event ApyLimitsChanged(uint256 minApy, uint256 maxApy);

    /**
     * @dev Emitted when participation factor changed
     * @param participationFactor New participation factor
     */
    event ParticipationFactorChanged(uint256 participationFactor);

    /**
     * @dev Emitted when risk aversion changed
     * @param riskAversion New risk aversion factor
     */
    event RiskAversionChanged(uint256 riskAversion);

    /**
     * @dev Emitted when the minimum voting period is changed
     * @param votingPeriod New voting period
     */
    event VotingPeriodChanged(uint256 votingPeriod);

    /**
     * @dev Emitted when the loan size bounds are changed
     * @param minSize New minimum loan size
     * @param maxSize New maximum loan size
     */
    event SizeLimitsChanged(uint256 minSize, uint256 maxSize);

    /**
     * @dev Emitted when loan term bounds are changed
     * @param minTerm New minimum loan term
     * @param maxTerm New minimum loan term
     */
    event TermLimitsChanged(uint256 minTerm, uint256 maxTerm);

    /**
     * @dev Emitted when loans limit is changed
     * @param maxLoans new maximum amount of loans
     */
    event LoansLimitChanged(uint256 maxLoans);

    /**
     * @dev Emitted when stakingPool address is changed
     * @param pool new stakingPool address
     */
    event StakingPoolChanged(IStakingPool pool);

    /**
     * @dev Emitted when a loan is funded
     * @param loanToken LoanToken contract which was funded
     * @param amount Amount funded
     */
    event Funded(address indexed loanToken, uint256 amount);

    /**
     * @dev Emitted when funds are reclaimed from the LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     * @param amount Amount repaid
     */
    event Reclaimed(address indexed loanToken, uint256 amount);

    /**
     * @dev Modifier for only lending pool
     */
    modifier onlyPool() {
        require(msg.sender == address(pool), "TrueLender: Sender is not a pool");
        _;
    }

    /**
     * @dev Initalize the contract with parameters
     * @param _pool Lending pool address
     * @param _ratingAgency Prediction market address
     */
    function initialize(
        ITrueFiPool _pool,
        ITrueRatingAgency _ratingAgency,
        IStakingPool _stakingPool
    ) public initializer {
        Ownable.initialize();

        pool = _pool;
        currencyToken = _pool.currencyToken();
        currencyToken.approve(address(_pool), uint256(-1));
        ratingAgency = _ratingAgency;
        stakingPool = _stakingPool;

        minApy = 1000;
        maxApy = 3000;
        participationFactor = 10000;
        riskAversion = 15000;
        minSize = 1000000 ether;
        maxSize = 10000000 ether;
        minTerm = 182 days;
        maxTerm = 3650 days;
        votingPeriod = 7 days;

        maxLoans = 100;
    }

    /**
     * @dev set stake pool address
     * @param newPool stake pool address to be set
     */
    function setStakingPool(IStakingPool newPool) public onlyOwner {
        stakingPool = newPool;
        emit StakingPoolChanged(newPool);
    }

    /**
     * @dev Set new bounds on loan size. Only owner can change parameters.
     * @param min New minimum loan size
     * @param max New maximum loan size
     */
    function setSizeLimits(uint256 min, uint256 max) external onlyOwner {
        require(min > 0, "TrueLender: Minimal loan size cannot be 0");
        require(max >= min, "TrueLender: Maximal loan size is smaller than minimal");
        minSize = min;
        maxSize = max;
        emit SizeLimitsChanged(min, max);
    }

    /**
     * @dev Set new bounds on loan term length. Only owner can change parameters.
     * @param min New minimum loan term
     * @param max New maximum loan term
     */
    function setTermLimits(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLender: Maximal loan term is smaller than minimal");
        minTerm = min;
        maxTerm = max;
        emit TermLimitsChanged(min, max);
    }

    /**
     * @dev Set new bounds on loan APY. Only owner can change parameters.
     * @param newMinApy New minimum loan APY
     * @param newMaxApy New maximum loan APY
     */
    function setApyLimits(uint256 newMinApy, uint256 newMaxApy) external onlyOwner {
        require(newMaxApy >= newMinApy, "TrueLender: Maximal APY is smaller than minimal");
        minApy = newMinApy;
        maxApy = newMaxApy;
        emit ApyLimitsChanged(newMinApy, newMaxApy);
    }

    /**
     * @dev Set new minimum voting period in credit rating market.
     * Only owner can change parameters
     * @param newVotingPeriod new minimum voting period
     */
    function setVotingPeriod(uint256 newVotingPeriod) external onlyOwner {
        votingPeriod = newVotingPeriod;
        emit VotingPeriodChanged(newVotingPeriod);
    }

    /**
     * @dev Set new participation factor. Only owner can change parameters.
     * @param newParticipationFactor New participation factor.
     */
    function setParticipationFactor(uint256 newParticipationFactor) external onlyOwner {
        participationFactor = newParticipationFactor;
        emit ParticipationFactorChanged(newParticipationFactor);
    }

    /**
     * @dev Set new risk aversion factor. Only owner can change parameters.
     * @param newRiskAversion New risk aversion factor
     */
    function setRiskAversion(uint256 newRiskAversion) external onlyOwner {
        riskAversion = newRiskAversion;
        emit RiskAversionChanged(newRiskAversion);
    }

    /**
     * @dev Set new loans limit. Only owner can change parameters.
     * @param newLoansLimit New loans limit
     */
    function setLoansLimit(uint256 newLoansLimit) external onlyOwner {
        maxLoans = newLoansLimit;
        emit LoansLimitChanged(maxLoans);
    }

    /**
     * @dev Get currently funded loans
     * @return result Array of loans currently funded
     */
    function loans() public view returns (ILoanToken[] memory result) {
        result = _loans;
    }

    /**
     * @dev Fund a loan which meets the strategy requirements
     * @param loanToken LoanToken to fund
     */
    function fund(ILoanToken loanToken) external {
        require(loanToken.borrower() == msg.sender, "TrueLender: Sender is not borrower");
        require(loanToken.isLoanToken(), "TrueLender: Only LoanTokens can be funded");
        require(loanToken.currencyToken() == currencyToken, "TrueLender: Only the same currency LoanTokens can be funded");
        require(_loans.length < maxLoans, "TrueLender: Loans number has reached the limit");

        (uint256 amount, uint256 apy, uint256 term) = loanToken.getParameters();
        uint256 receivedAmount = loanToken.receivedAmount();
        (uint256 start, uint256 no, uint256 yes) = ratingAgency.getResults(address(loanToken));

        require(loanSizeWithinBounds(amount), "TrueLender: Loan size is out of bounds");
        require(loanTermWithinBounds(term), "TrueLender: Loan term is out of bounds");
        require(loanIsAttractiveEnough(apy), "TrueLender: APY is out of bounds");
        require(votingLastedLongEnough(start), "TrueLender: Voting time is below minimum");
        require(votesThresholdReached(amount, yes), "TrueLender: Not enough votes given for the loan");
        require(loanIsCredible(apy, term, yes, no), "TrueLender: Loan risk is too high");

        _loans.push(loanToken);
        pool.borrow(amount, amount.sub(receivedAmount));
        currencyToken.approve(address(loanToken), receivedAmount);
        loanToken.fund();

        pool.approve(address(stakingPool), pool.balanceOf(address(this)));
        stakingPool.payFee(pool.balanceOf(address(this)), block.timestamp.add(term));

        emit Funded(address(loanToken), receivedAmount);
    }

    /**
     * @dev Temporary fix for old LoanTokens with incorrect value calculation
     */
    function loanValue(ILoanToken loan) public view returns (uint256) {
        uint256 _balance = loan.balanceOf(address(this));
        if (_balance == 0) {
            return 0;
        }

        uint256 passed = block.timestamp.sub(loan.start());
        if (passed > loan.term()) {
            passed = loan.term();
        }

        uint256 helper = loan.amount().mul(loan.apy()).mul(passed).mul(_balance);
        // assume month is 30 days
        uint256 interest = helper.div(365 days).div(10000).div(loan.debt());

        return loan.amount().mul(_balance).div(loan.debt()).add(interest);
    }

    /**
     * @dev Loop through loan tokens and calculate theoretical value of all loans
     * There should never be too many loans in the pool to run out of gas
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value() external override view returns (uint256) {
        uint256 totalValue;
        for (uint256 index = 0; index < _loans.length; index++) {
            totalValue = totalValue.add(loanValue(_loans[index]));
        }
        return totalValue;
    }

    /**
     * @dev For settled loans, redeem LoanTokens for underlying funds
     * @param loanToken Loan to reclaim capital from (must be previously funded)
     */
    function reclaim(ILoanToken loanToken) external {
        require(loanToken.isLoanToken(), "TrueLender: Only LoanTokens can be used to reclaimed");

        ILoanToken.Status status = loanToken.status();
        require(status >= ILoanToken.Status.Settled, "TrueLender: LoanToken is not closed yet");

        if (status != ILoanToken.Status.Settled) {
            require(msg.sender == owner(), "TrueLender: Only owner can reclaim from defaulted loan");
        }

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

                emit Reclaimed(address(loanToken), fundsReclaimed);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        revert("TrueLender: This loan has not been funded by the lender");
    }

    /**
     * @dev Withdraw a basket of tokens held by the pool
     * When exiting the pool, the pool contract calls this function
     * to withdraw a fraction of all the loans held by the pool
     * Loop through recipient's share of LoanTokens and calculate versus total per loan.
     * There should never be too many loans in the pool to run out of gas
     *
     * @param recipient Recipient of basket
     * @param numerator Numerator of fraction to withdraw
     * @param denominator Denominator of fraction to withdraw
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

    /**
     * @dev Check if a loan is within APY bounds
     * @param apy APY of loan
     * @return Whether a loan is within APY bounds
     */
    function loanIsAttractiveEnough(uint256 apy) public view returns (bool) {
        return apy >= minApy && apy <= maxApy;
    }

    /**
     * @dev Check if a loan has been in the credit market long enough
     * @param start Timestamp at which rating began
     * @return Whether a loan has been rated for long enough
     */
    function votingLastedLongEnough(uint256 start) public view returns (bool) {
        return start.add(votingPeriod) <= block.timestamp;
    }

    /**
     * @dev Check if a loan is within size bounds
     * @param amount Size of loan
     * @return Whether a loan is within size bounds
     */
    function loanSizeWithinBounds(uint256 amount) public view returns (bool) {
        return amount >= minSize && amount <= maxSize;
    }

    /**
     * @dev Check if loan term is within term bounds
     * @param term Term of loan
     * @return Whether loan term is within term bounds
     */
    function loanTermWithinBounds(uint256 term) public view returns (bool) {
        return term >= minTerm && term <= maxTerm;
    }

    /**
     * @dev Check if a loan is within APY bounds
     * Minimum absolute value of yes votes, rather than ratio of yes to no
     * @param amount Size of loan
     * @param yesVotes Number of yes votes
     * @return Whether a loan has reached the required voting threshold
     */
    function votesThresholdReached(uint256 amount, uint256 yesVotes) public view returns (bool) {
        return amount.mul(participationFactor) <= yesVotes.mul(10000).mul(TOKEN_PRECISION_DIFFERENCE);
    }

    /**
     * @dev Use APY and term of loan to check expected value of a loan
     * Expected value = profit - (default_loss * (no / yes))
     * e.g. riskAversion = 10,000 => expected value of 1
     * @param apy APY of loan
     * @param term Term length of loan
     * @param yesVotes Number of YES votes in credit market
     * @param noVotes Number of NO votes in credit market
     */
    function loanIsCredible(
        uint256 apy,
        uint256 term,
        uint256 yesVotes,
        uint256 noVotes
    ) public view returns (bool) {
        return apy.mul(term).mul(yesVotes).div(365 days) >= noVotes.mul(riskAversion);
    }
}
