// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Ownable} from "../common/UpgradeableOwnable.sol";
import {ILoanToken2, ILoanToken} from "./interface/ILoanToken2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";

/**
 * @title TrueLender v2.0
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * TrueLender holds all LoanTokens and may distribute them on pool exits
 */
contract TrueLender2 is ITrueLender2, Ownable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => ILoanToken2[]) loansOnPool;

    // maximum amount of loans lender can handle at once
    uint256 public maxLoans;

    IStakingPool public stakingPool;

    IPoolFactory public factory;
    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a borrower's whitelist status changes
     * @param who Address for which whitelist status has changed
     * @param status New whitelist status
     */
    event Allowed(address indexed who, bool status);

    /**
     * @dev Emitted when loans limit is changed
     * @param maxLoans new maximum amount of loans
     */
    event LoansLimitChanged(uint256 maxLoans);

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
     */
    function initialize(IStakingPool _stakingPool, IPoolFactory _factory) public initializer {
        Ownable.initialize();

        stakingPool = _stakingPool;
        factory = _factory;

        maxLoans = 100;
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
    function loans(ITrueFiPool2 pool) public view returns (ILoanToken2[] memory result) {
        result = loansOnPool[pool];
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
        // TODO add check of
        require(msg.sender == loanToken.borrower(), "TrueLender: Sender is not borrower");
        ITrueFiPool2 pool = loanToken.pool();

        require(factory.isPool(address(pool)), "TrueLender: Pool not created by the factory");
        require(loanToken.currencyToken() == pool.token(), "TrueLender: Loan and pool token mismatch");
        require(loansOnPool[pool].length < maxLoans, "TrueLender: Loans number has reached the limit");

        (uint256 amount, , uint256 term) = loanToken.getParameters();
        uint256 receivedAmount = loanToken.receivedAmount();

        loansOnPool[pool].push(loanToken);
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
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value(ITrueFiPool2 pool) external override view returns (uint256) {
        ILoanToken2[] storage _loans = loansOnPool[pool];
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
        ILoanToken2[] storage _loans = loansOnPool[pool];
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

    /// @dev Helper function to redeem funds from `loanToken` and repay them into the `pool`
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

    function _distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) internal {
        ILoanToken2[] storage _loans = loansOnPool[ITrueFiPool2(pool)];
        for (uint256 index = 0; index < _loans.length; index++) {
            _loans[index].transfer(recipient, numerator.mul(_loans[index].balanceOf(address(this))).div(denominator));
        }
    }
}
