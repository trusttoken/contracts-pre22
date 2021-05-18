// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {OneInchExchange} from "./libraries/OneInchExchange.sol";

import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ITrueFiPool2, ITrueFiPoolOracle, I1Inch3} from "./interface/ITrueFiPool2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ITrueRatingAgency} from "../truefi/interface/ITrueRatingAgency.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";

/**
 * @title TrueLender v2.0
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * TrueLender holds all LoanTokens and may distribute them on pool exits
 */
contract TrueLender2 is ITrueLender2, UpgradeableClaimable {
    using SafeMath for uint256;
    using OneInchExchange for I1Inch3;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    uint256 private constant ONE_INCH_PARTIAL_FILL_FLAG = 0x01;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => ILoanToken2[]) public poolLoans;

    // maximum amount of loans lender can handle at once
    uint256 public maxLoans;

    // which part of interest should be paid to the stakers
    uint256 public fee;

    IStakingPool public stakingPool;

    IPoolFactory public factory;

    ITrueRatingAgency public ratingAgency;

    I1Inch3 public _1inch;

    // Loan fees should be swapped for this token, deposited into the feePool
    // and pool's LP tokens should be sent to the stakers
    IERC20WithDecimals public feeToken;
    ITrueFiPool2 public feePool;

    // Minimal possible fee swap slippage
    // basis precision: 10000 = 100%
    uint256 public swapFeeSlippage;

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
     * @dev Emitted when loan fee is changed
     * @param newFee New fee value in basis points
     */
    event FeeChanged(uint256 newFee);

    /**
     * @dev Emitted when loan fee pool is changed
     * @param newFeePool New fee pool address
     */
    event FeePoolChanged(ITrueFiPool2 newFeePool);

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
     * @param _ratingAgency TrueRatingAgencyV2 address
     * @param __1inch 1Inch exchange address (0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     */
    function initialize(
        IStakingPool _stakingPool,
        IPoolFactory _factory,
        ITrueRatingAgency _ratingAgency,
        I1Inch3 __1inch
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        stakingPool = _stakingPool;
        factory = _factory;
        ratingAgency = _ratingAgency;
        _1inch = __1inch;

        swapFeeSlippage = 100; // 1%
        minVotes = 15 * (10**6) * (10**8);
        minRatio = 8000;
        votingPeriod = 7 days;
        fee = 1000;
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
     * @dev Set new fee pool and fee token.
     * Only owner can change parameters
     * @param newFeePool new pool address
     */
    function setFeePool(ITrueFiPool2 newFeePool) external onlyOwner {
        feeToken = IERC20WithDecimals(address(newFeePool.token()));
        feePool = newFeePool;
        emit FeePoolChanged(newFeePool);
    }

    /**
     * @dev Set loan interest fee that goes to the stakers.
     * @param newFee New loans limit
     */
    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= BASIS_RATIO, "TrueLender: fee cannot be more than 100%");
        fee = newFee;
        emit FeeChanged(newFee);
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
        require(msg.sender == loanToken.borrower(), "TrueLender: Sender is not borrower");
        ITrueFiPool2 pool = loanToken.pool();

        require(factory.isPool(address(pool)), "TrueLender: Pool not created by the factory");
        require(loanToken.token() == pool.token(), "TrueLender: Loan and pool token mismatch");
        require(poolLoans[pool].length < maxLoans, "TrueLender: Loans number has reached the limit");

        uint256 amount = loanToken.amount();
        (uint256 start, uint256 no, uint256 yes) = ratingAgency.getResults(address(loanToken));

        require(votingLastedLongEnough(start), "TrueLender: Voting time is below minimum");
        require(votesThresholdReached(yes.add(no)), "TrueLender: Not enough votes given for the loan");
        require(loanIsCredible(yes, no), "TrueLender: Loan risk is too high");

        poolLoans[pool].push(loanToken);
        pool.borrow(amount);
        pool.token().approve(address(loanToken), amount);
        loanToken.fund();

        emit Funded(address(pool), address(loanToken), amount);
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
    function reclaim(ILoanToken2 loanToken, bytes calldata data) external {
        ITrueFiPool2 pool = loanToken.pool();
        ILoanToken2.Status status = loanToken.status();
        require(status >= ILoanToken2.Status.Settled, "TrueLender: LoanToken is not closed yet");

        if (status != ILoanToken2.Status.Settled) {
            require(msg.sender == owner(), "TrueLender: Only owner can reclaim from defaulted loan");
        }

        // find the token, repay loan and remove loan from loan array
        ILoanToken2[] storage _loans = poolLoans[pool];
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loanToken) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();

                uint256 fundsReclaimed = _redeemAndRepay(loanToken, pool, data);
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
    function _redeemAndRepay(
        ILoanToken2 loanToken,
        ITrueFiPool2 pool,
        bytes calldata data
    ) internal returns (uint256) {
        // call redeem function on LoanToken
        uint256 balanceBefore = pool.token().balanceOf(address(this));
        loanToken.redeem(loanToken.balanceOf(address(this)));
        uint256 balanceAfter = pool.token().balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        uint256 fundsReclaimed = balanceAfter.sub(balanceBefore);

        uint256 feeAmount = 0;
        if (address(feeToken) != address(0)) {
            // swap fee for feeToken
            feeAmount = _swapFee(pool, loanToken, data);
        }

        pool.token().approve(address(pool), fundsReclaimed.sub(feeAmount));
        pool.repay(fundsReclaimed.sub(feeAmount));

        if (address(feeToken) != address(0)) {
            // join pool and reward stakers
            _transferFeeToStakers();
        }
        return fundsReclaimed;
    }

    /// @dev Swap `token` for `feeToken` on 1inch
    function _swapFee(
        ITrueFiPool2 pool,
        ILoanToken2 loanToken,
        bytes calldata data
    ) internal returns (uint256) {
        uint256 feeAmount = loanToken.debt().sub(loanToken.amount()).mul(fee).div(BASIS_RATIO);
        IERC20WithDecimals token = IERC20WithDecimals(address(pool.token()));
        if (token == feeToken) {
            return feeAmount;
        }
        if (feeAmount == 0) {
            return 0;
        }
        uint256 balanceBefore = feeToken.balanceOf(address(this));
        I1Inch3.SwapDescription memory swap = _1inch.exchange(data);
        uint256 balanceDiff = feeToken.balanceOf(address(this)).sub(balanceBefore);
        uint256 expectedDiff = pool.oracle().tokenToUsd(feeAmount).mul(10**feeToken.decimals()).div(1 ether);

        require(
            balanceDiff >= expectedDiff.mul(BASIS_RATIO.sub(swapFeeSlippage)).div(BASIS_RATIO),
            "TrueLender: Fee returned from swap is too small"
        );
        require(swap.srcToken == address(token), "TrueLender: Source token is not same as pool's token");
        require(swap.dstToken == address(feeToken), "TrueLender: Destination token is not fee token");
        require(swap.dstReceiver == address(this), "TrueLender: Receiver is not lender");
        require(swap.amount == feeAmount, "TrueLender: Incorrect fee swap amount");
        require(swap.flags & ONE_INCH_PARTIAL_FILL_FLAG == 0, "TrueLender: Partial fill is not allowed");

        return feeAmount;
    }

    /// @dev Deposit feeToken to pool and transfer LP tokens to the stakers
    function _transferFeeToStakers() internal {
        uint256 amount = feeToken.balanceOf(address(this));
        if (amount == 0) {
            return;
        }
        feeToken.approve(address(feePool), amount);
        feePool.join(amount);
        feePool.transfer(address(stakingPool), feePool.balanceOf(address(this)));
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
        require(factory.isPool(msg.sender), "TrueLender: Pool not created by the factory");
        _distribute(recipient, numerator, denominator, msg.sender);
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
     * @dev Check if a loan has enough votes to be approved
     * @param votes Total number of votes
     * @return Whether a loan has reached the required voting threshold
     */
    function votesThresholdReached(uint256 votes) public view returns (bool) {
        return votes >= minVotes;
    }

    /**
     * @dev Check if yes to no votes ratio reached the minimum rate
     * @param yesVotes Number of YES votes in credit market
     * @param noVotes Number of NO votes in credit market
     */
    function loanIsCredible(uint256 yesVotes, uint256 noVotes) public view returns (bool) {
        uint256 totalVotes = yesVotes.add(noVotes);
        return yesVotes >= totalVotes.mul(minRatio).div(BASIS_RATIO);
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
