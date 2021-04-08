// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {UpgradeableClaimable as Claimable} from "../common/UpgradeableClaimable.sol";
import {ILoanToken2, ILoanToken} from "./interface/ILoanToken2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ITrueRatingAgency} from "../truefi/interface/ITrueRatingAgency.sol";

/**
 * @title TrueLender v2.0
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * TrueLender holds all LoanTokens and may distribute them on pool exits
 */
contract TrueLender2 is ITrueLender2, Claimable {
    using SafeMath for uint256;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => ILoanToken2[]) poolLoans;

    // maximum amount of loans lender can handle at once
    uint256 public maxLoans;

    IStakingPool public stakingPool;

    IPoolFactory public factory;

    ITrueRatingAgency public ratingAgency;

    // ===== Voting parameters =====

    // How many votes are needed for a loan to be approved
    uint256 public minVotes;

    // Minimum ratio of yes votes to total votes for a loan to be approved
    // basis precision: 10000 = 100%
    uint256 public minRatio;

    // minimum prediction market voting period
    uint256 public votingPeriod;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when loans limit is changed
     * @param maxLoans new maximum amount of loans
     */
    event LoansLimitChanged(uint256 maxLoans);

    /**
     * @dev Emitted when minVotes changed
     * @param minVotes New minVotes
     */
    event MinVotesChanged(uint256 minVotes);

    /**
     * @dev Emitted when risk aversion changed
     * @param minRatio New risk aversion factor
     */
    event MinRatioChanged(uint256 minRatio);

    /**
     * @dev Emitted when the minimum voting period is changed
     * @param votingPeriod New voting period
     */
    event VotingPeriodChanged(uint256 votingPeriod);

    /**
     * @dev Emitted when a loan is funded
     * @param loanToken LoanToken contract which was funded
     * @param amount Amount funded
     */
    event Funded(address indexed pool, address loanToken, uint256 amount);

    /**
     * @dev Emitted when funds are reclaimed from the LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     * @param amount Amount repaid
     */
    event Reclaimed(address indexed pool, address loanToken, uint256 amount);

    /**
     * @dev Initialize the contract with parameters
     * @param _stakingPool stkTRU address
     * @param _factory PoolFactory address
     */
    function initialize(
        IStakingPool _stakingPool,
        IPoolFactory _factory,
        ITrueRatingAgency _ratingAgency
    ) public initializer {
        Claimable.initialize(msg.sender);

        stakingPool = _stakingPool;
        factory = _factory;
        ratingAgency = _ratingAgency;

        minVotes = 15 * (10**6) * (10**8);
        minRatio = 8000;
        votingPeriod = 7 days;

        maxLoans = 100;
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
     * @dev Set new minimal amount of votes for loan to be approved. Only owner can change parameters.
     * @param newMinVotes New minVotes.
     */
    function setMinVotes(uint256 newMinVotes) external onlyOwner {
        minVotes = newMinVotes;
        emit MinVotesChanged(newMinVotes);
    }

    /**
     * @dev Set new yes to no votes ratio. Only owner can change parameters.
     * @param newMinRatio New yes to no votes ratio
     */
    function setMinRatio(uint256 newMinRatio) external onlyOwner {
        require(newMinRatio <= BASIS_RATIO, "TrueLender: minRatio cannot be more than 100%");
        minRatio = newMinRatio;
        emit MinRatioChanged(newMinRatio);
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
     * @dev Get currently funded loans for a pool
     * @param pool pool address
     * @return result Array of loans currently funded
     */
    function loans(ITrueFiPool2 pool) public view returns (ILoanToken2[] memory result) {
        result = poolLoans[pool];
    }

    /**
     * @dev Fund a loan
     * LoanToken should be created by the LoanFactory over the pool
     * than was also created by the PoolFactory.
     * Method should be called by the loan borrower
     *
     * When called, lender takes funds from the pool, gives it to the loan and holds all LoanTokens
     * Origination fee is transferred to the stake
     *
     * @param loanToken LoanToken to fund
     */
    function fund(ILoanToken2 loanToken) external {
        // TODO add check if pool was created by the loan factory
        require(msg.sender == loanToken.borrower(), "TrueLender: Sender is not borrower");
        ITrueFiPool2 pool = loanToken.pool();

        require(factory.isPool(address(pool)), "TrueLender: Pool not created by the factory");
        require(loanToken.currencyToken() == pool.token(), "TrueLender: Loan and pool token mismatch");
        require(poolLoans[pool].length < maxLoans, "TrueLender: Loans number has reached the limit");

        (uint256 amount, , uint256 term) = loanToken.getParameters();
        uint256 receivedAmount = loanToken.receivedAmount();

        poolLoans[pool].push(loanToken);
        pool.borrow(amount, amount.sub(receivedAmount));
        pool.token().approve(address(loanToken), receivedAmount);
        loanToken.fund();

        pool.approve(address(stakingPool), pool.balanceOf(address(this)));
        stakingPool.payFee(pool.balanceOf(address(this)), block.timestamp.add(term));

        emit Funded(address(pool), address(loanToken), receivedAmount);
    }

    /**
     * @dev Loop through loan tokens for the pool and calculate theoretical value of all loans
     * There should never be too many loans in the pool to run out of gas
     * @param pool pool address
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value(ITrueFiPool2 pool) external override view returns (uint256) {
        ILoanToken2[] storage _loans = poolLoans[pool];
        uint256 totalValue;
        for (uint256 index = 0; index < _loans.length; index++) {
            totalValue = totalValue.add(_loans[index].value(_loans[index].balanceOf(address(this))));
        }
        return totalValue;
    }

    /**
     * @dev For settled loans, redeem LoanTokens for underlying funds
     * @param loanToken Loan to reclaim capital from (must be previously funded)
     */
    function reclaim(ILoanToken2 loanToken) external {
        ITrueFiPool2 pool = loanToken.pool();
        ILoanToken.Status status = loanToken.status();
        require(status >= ILoanToken.Status.Settled, "TrueLender: LoanToken is not closed yet");

        if (status != ILoanToken.Status.Settled) {
            require(msg.sender == owner(), "TrueLender: Only owner can reclaim from defaulted loan");
        }

        // find the token, repay loan and remove loan from loan array
        ILoanToken2[] storage _loans = poolLoans[pool];
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loanToken) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();

                uint256 fundsReclaimed = _redeemAndRepay(loanToken, pool);

                emit Reclaimed(address(pool), address(loanToken), fundsReclaimed);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        // This prevents invalid loans from being reclaimed
        revert("TrueLender: This loan has not been funded by the lender");
    }

    /**
     * @dev Helper function to redeem funds from `loanToken` and repay them into the `pool`
     * @param loanToken Loan to reclaim capital from
     * @param pool Pool from which the loan was funded
     */
    function _redeemAndRepay(ILoanToken2 loanToken, ITrueFiPool2 pool) internal returns (uint256 fundsReclaimed) {
        // call redeem function on LoanToken
        uint256 balanceBefore = pool.token().balanceOf(address(this));
        loanToken.redeem(loanToken.balanceOf(address(this)));
        uint256 balanceAfter = pool.token().balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        fundsReclaimed = balanceAfter.sub(balanceBefore);
        pool.token().approve(address(pool), fundsReclaimed);
        pool.repay(fundsReclaimed);
    }

    /**
     * @dev Withdraw a basket of tokens held by the pool
     * Function is expected to be called by the pool
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
    ) external override {
        _distribute(recipient, numerator, denominator, msg.sender);
    }

    /// @dev Helper used in tests
    function _distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) internal {
        ILoanToken2[] storage _loans = poolLoans[ITrueFiPool2(pool)];
        for (uint256 index = 0; index < _loans.length; index++) {
            _loans[index].transfer(recipient, numerator.mul(_loans[index].balanceOf(address(this))).div(denominator));
        }
    }
}
