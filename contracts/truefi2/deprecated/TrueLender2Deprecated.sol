// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";
import {OneInchExchange} from "../libraries/OneInchExchange.sol";

import {ILoanToken2Deprecated} from "./ILoanToken2Deprecated.sol";
import {IStakingPool} from "../../truefi/interface/IStakingPool.sol";
import {ITrueLender2Deprecated} from "./ITrueLender2Deprecated.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";
import {I1Inch3} from "../interface/I1Inch3.sol";
import {IPoolFactory} from "../interface/IPoolFactory.sol";
import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";

/**
 * @title TrueLender v2.0
 * @dev Loans management helper
 * This contract is a bridge that helps to transfer funds from pool to the loans and back
 * TrueLender holds all LoanTokens and may distribute them on pool exits
 */
contract TrueLender2Deprecated is ITrueLender2Deprecated, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IERC20WithDecimals;
    using SafeERC20 for ITrueFiPool2;
    using SafeERC20 for ILoanToken2Deprecated;
    using OneInchExchange for I1Inch3;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    uint256 private constant ONE_INCH_PARTIAL_FILL_FLAG = 0x01;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => ILoanToken2Deprecated[]) public poolLoans;

    // maximum amount of loans lender can handle at once
    uint256 private DEPRECATED__maxLoans;

    // which part of interest should be paid to the stakers
    uint256 public fee;

    IStakingPool public stakingPool;

    IPoolFactory public factory;

    address private DEPRECATED__ratingAgency;

    I1Inch3 public _1inch;

    // Loan fees should be swapped for this token, deposited into the feePool
    // and pool's LP tokens should be sent to the stakers
    IERC20WithDecimals public feeToken;
    ITrueFiPool2 public feePool;

    // Minimal possible fee swap slippage
    // basis precision: 10000 = 100%
    uint256 public swapFeeSlippage;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when loan fee is changed
     * @param newFee New fee value in basis points
     */
    event FeeChanged(uint256 newFee);

    /**
     * @dev Emitted when fee pool is changed
     * @param newFeePool New fee pool address
     */
    event FeePoolChanged(ITrueFiPool2 newFeePool);

    /**
     * @dev Emitted when funds are reclaimed from the LoanToken contract
     * @param loanToken LoanToken from which funds were reclaimed
     * @param amount Amount repaid
     */
    event Reclaimed(address indexed pool, address loanToken, uint256 amount);

    /**
     * @dev Can be only called by a pool
     */
    modifier onlySupportedPool() {
        require(factory.isSupportedPool(ITrueFiPool2(msg.sender)), "TrueLender: Pool not supported by the factory");
        _;
    }

    /**
     * @dev Initialize the contract with parameters
     * @param _stakingPool stkTRU address
     * @param _factory PoolFactory address
     * @param __1inch 1Inch exchange address (0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     */
    function initialize(
        IStakingPool _stakingPool,
        IPoolFactory _factory,
        I1Inch3 __1inch
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        stakingPool = _stakingPool;
        factory = _factory;
        _1inch = __1inch;

        swapFeeSlippage = 100; // 1%
        fee = 1000;
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
    function loans(ITrueFiPool2 pool) public view returns (ILoanToken2Deprecated[] memory result) {
        result = poolLoans[pool];
    }

    /**
     * @dev Loop through loan tokens for the pool and calculate theoretical value of all loans
     * There should never be too many loans in the pool to run out of gas
     * @param pool pool address
     * @return Theoretical value of all the loans funded by this strategy
     */
    function value(ITrueFiPool2 pool) external view override returns (uint256) {
        ILoanToken2Deprecated[] storage _loans = poolLoans[pool];
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
    function reclaim(ILoanToken2Deprecated loanToken, bytes calldata data) external {
        ITrueFiPool2 pool = loanToken.pool();
        ILoanToken2Deprecated.Status status = loanToken.status();
        require(status >= ILoanToken2Deprecated.Status.Settled, "TrueLender: LoanToken is not closed yet");

        if (status != ILoanToken2Deprecated.Status.Settled) {
            require(msg.sender == owner(), "TrueLender: Only owner can reclaim from defaulted loan");
        }

        // find the token, repay loan and remove loan from loan array
        ILoanToken2Deprecated[] storage _loans = poolLoans[pool];
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
        ILoanToken2Deprecated loanToken,
        ITrueFiPool2 pool,
        bytes calldata data
    ) internal returns (uint256) {
        // call redeem function on LoanToken
        uint256 balanceBefore = pool.token().balanceOf(address(this));
        loanToken.redeem(loanToken.balanceOf(address(this)));
        uint256 balanceAfter = pool.token().balanceOf(address(this));

        // gets reclaimed amount and pays back to pool
        uint256 fundsReclaimed = balanceAfter.sub(balanceBefore);

        uint256 feeAmount;
        if (address(feeToken) != address(0)) {
            // swap fee for feeToken
            feeAmount = _swapFee(pool, loanToken, data);
        }

        pool.token().safeApprove(address(pool), fundsReclaimed.sub(feeAmount));
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
        ILoanToken2Deprecated loanToken,
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
        (I1Inch3.SwapDescription memory swap, uint256 balanceDiff) = _1inch.exchange(data);
        uint256 expectedDiff = pool.oracle().tokenToUsd(feeAmount).mul(10**feeToken.decimals()).div(1 ether);

        require(swap.srcToken == address(token), "TrueLender: Source token is not same as pool's token");
        require(swap.dstToken == address(feeToken), "TrueLender: Destination token is not fee token");
        require(swap.dstReceiver == address(this), "TrueLender: Receiver is not lender");
        require(swap.amount == feeAmount, "TrueLender: Incorrect fee swap amount");
        require(swap.flags & ONE_INCH_PARTIAL_FILL_FLAG == 0, "TrueLender: Partial fill is not allowed");
        require(
            balanceDiff >= expectedDiff.mul(BASIS_RATIO.sub(swapFeeSlippage)).div(BASIS_RATIO),
            "TrueLender: Fee returned from swap is too small"
        );

        return feeAmount;
    }

    /// @dev Deposit feeToken to pool and transfer LP tokens to the stakers
    function _transferFeeToStakers() internal {
        uint256 amount = feeToken.balanceOf(address(this));
        if (amount == 0) {
            return;
        }
        feeToken.safeApprove(address(feePool), amount);
        feePool.join(amount);
        feePool.safeTransfer(address(stakingPool), feePool.balanceOf(address(this)));
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
    ) external override onlySupportedPool {
        _distribute(recipient, numerator, denominator, msg.sender);
    }

    /**
     * @dev Allow pool to transfer all LoanTokens to the SAFU in case of liquidation
     * @param loan LoanToken address
     * @param recipient expected to be SAFU address
     */
    function transferAllLoanTokens(ILoanToken2Deprecated loan, address recipient) external override onlySupportedPool {
        _transferAllLoanTokens(loan, recipient);
    }

    function _transferAllLoanTokens(ILoanToken2Deprecated loan, address recipient) internal {
        // find the token, transfer to SAFU and remove loan from loans list
        ILoanToken2Deprecated[] storage _loans = poolLoans[loan.pool()];
        for (uint256 index = 0; index < _loans.length; index++) {
            if (_loans[index] == loan) {
                _loans[index] = _loans[_loans.length - 1];
                _loans.pop();

                _transferLoan(loan, recipient, 1, 1);
                return;
            }
        }
        // If we reach this, it means loanToken was not present in _loans array
        // This prevents invalid loans from being reclaimed
        revert("TrueLender: This loan has not been funded by the lender");
    }

    /// @dev Helper used in tests
    function _distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator,
        address pool
    ) internal {
        ILoanToken2Deprecated[] storage _loans = poolLoans[ITrueFiPool2(pool)];
        for (uint256 index = 0; index < _loans.length; index++) {
            _transferLoan(_loans[index], recipient, numerator, denominator);
        }
    }

    // @dev Transfer (numerator/denominator)*balance of loan to the recipient
    function _transferLoan(
        ILoanToken2Deprecated loan,
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) internal {
        loan.safeTransfer(recipient, numerator.mul(loan.balanceOf(address(this))).div(denominator));
    }

    function deprecate() external {
        DEPRECATED__maxLoans = type(uint256).max;
        DEPRECATED__ratingAgency = address(0);
    }
}
