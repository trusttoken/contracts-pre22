// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {IFixedTermLoanAgency} from "./interface/IFixedTermLoanAgency.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";

/**
 * @title LoanToken V2
 * @dev A token which represents share of a debt obligation
 *
 * Each LoanToken has:
 * - borrower address
 * - borrow principal
 * - loan term
 * - loan APY
 *
 * Loans initialize to a Withdrawn state, which can only transition to terminal states:
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 *
 * - This version of LoanToken only supports a single funder
 */
contract LoanToken2 is ILoanToken2, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20WithDecimals;
    using SafeERC20 for IDebtToken;

    uint256 public constant BASIS_POINTS = 10000;

    Status public override status;

    address public borrower;

    uint256 public principal;
    uint256 public override interest;
    uint256 public tokenRedeemed;

    uint256 public start;
    uint256 public term;

    IERC20WithDecimals public token;

    IDebtToken public debtToken;

    ITrueFiPool2 public override pool;

    IBorrowingMutex public borrowingMutex;

    ITrueFiCreditOracle public creditOracle;

    ILoanFactory2 public loanFactory;

    /**
     * @dev Emitted when a LoanToken is repaid by the borrower in underlying tokens
     * @param repayer Sender of tokens
     * @param repaidAmount Amount of token repaid
     */
    event Repaid(address repayer, uint256 repaidAmount);

    /**
     * @dev Emitted when loan has been fully repaid
     * @param returnedAmount Amount that was returned
     */
    event Settled(uint256 returnedAmount);

    /**
     * @dev Emitted when term is over without full repayment
     * @param debtToken Deployed DebtToken address
     * @param unpaidAmount Amount left to pay
     */
    event Defaulted(IDebtToken debtToken, uint256 unpaidAmount);

    /**
     * @dev Emitted when a LoanToken is redeemed for underlying tokens
     * @param receiver Receiver of tokens
     * @param loanBurnedAmount Amount of LoanTokens burned
     * @param tokenRedeemedAmount Amount of token received
     */
    event Redeemed(address receiver, uint256 loanBurnedAmount, uint256 tokenRedeemedAmount);

    /**
     * @dev Create a Loan
     * @param _pool Pool to lend from
     * @param _borrower Borrower address
     * @param _ftlAgency FixedTermLoanAgency address
     * @param _loanFactory LoanFactory to create DebtTokens in case of default
     * @param _principal Borrow amount of underlying tokens
     * @param _term Loan length
     * @param _apy Loan APY
     */
    function initialize(
        ITrueFiPool2 _pool,
        IBorrowingMutex _mutex,
        address _borrower,
        IFixedTermLoanAgency _ftlAgency,
        address,
        ILoanFactory2 _loanFactory,
        ITrueFiCreditOracle _creditOracle,
        uint256 _principal,
        uint256 _term,
        uint256 _apy
    ) external initializer {
        ERC20.__ERC20_initialize("TrueFi Loan Token", "LOAN");

        status = Status.Withdrawn;
        borrower = _borrower;
        principal = _principal;
        interest = principal.mul(_apy).mul(_term).div(365 days).div(BASIS_POINTS);
        tokenRedeemed;
        start = block.timestamp;
        term = _term;
        token = IERC20WithDecimals(address(_pool.token()));
        debtToken;
        pool = _pool;
        borrowingMutex = _mutex;
        creditOracle = _creditOracle;
        loanFactory = _loanFactory;

        _mint(address(_ftlAgency), debt());
    }

    /**
     * @dev Only when loan is Withdrawn
     */
    modifier onlyWithdrawn() {
        require(status == Status.Withdrawn, "LoanToken2: Status is not Withdrawn");
        _;
    }

    /**
     * @dev Only when loan is Settled or Defaulted
     */
    modifier onlySettledOrDefaulted() {
        require(status == Status.Settled || status == Status.Defaulted, "LoanToken2: Status is not Settled or Defaulted");
        _;
    }

    /**
     * @dev Function for borrower to repay the loan
     * Borrower can repay at any time
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function repay(address _sender, uint256 _amount) external {
        _repay(_sender, _amount);
    }

    /**
     * @dev Function for borrower to repay all of the remaining loan balance
     * Borrower should use this to ensure full repayment
     * @param _sender account sending token to repay
     */
    function repayInFull(address _sender) external {
        _repay(_sender, debt().sub(tokenRepaid()));
    }

    /**
     * @dev Internal function for loan repayment
     * If _amount is sufficient, then this also settles the loan
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function _repay(address _sender, uint256 _amount) private {
        require(_amount.add(tokenRepaid()) <= debt(), "LoanToken2: Repay amount more than unpaid debt");
        emit Repaid(_sender, _amount);

        token.safeTransferFrom(_sender, address(this), _amount);
        if (isRepaid()) {
            settle();
        }
    }

    /**
     * @dev Settle the loan after checking it has been repaid
     */
    function settle() public onlyWithdrawn {
        require(isRepaid(), "LoanToken2: Loan must be fully repaid");
        status = Status.Settled;

        borrowingMutex.unlock(borrower);

        emit Settled(tokenRepaid());
    }

    /**
     * @dev Default the loan if it has not been repaid by the end of term
     */
    function enterDefault() external onlyWithdrawn {
        require(!isRepaid(), "LoanToken2: Loan is fully repaid");
        require(start.add(term).add(creditOracle.gracePeriod()) <= block.timestamp, "LoanToken2: Loan has not reached end of term");
        status = Status.Defaulted;

        uint256 unpaidDebt = debt().sub(tokenRepaid());

        debtToken = loanFactory.createDebtToken(pool, borrower, unpaidDebt);
        debtToken.safeApprove(address(pool), unpaidDebt);
        pool.addDebt(debtToken, unpaidDebt);

        borrowingMutex.ban(borrower);

        emit Defaulted(debtToken, unpaidDebt);
    }

    /**
     * @dev Redeem LoanToken balances for underlying token
     * Can only call this function after the loan is Closed
     */
    function redeem() external override onlySettledOrDefaulted {
        uint256 loanRedeemAmount = balanceOf(msg.sender);
        uint256 tokenRedeemAmount = loanRedeemAmount.mul(_tokenBalance()).div(totalSupply());
        tokenRedeemed = tokenRedeemed.add(tokenRedeemAmount);

        _burn(msg.sender, loanRedeemAmount);
        token.safeTransfer(msg.sender, tokenRedeemAmount);

        emit Redeemed(msg.sender, loanRedeemAmount, tokenRedeemAmount);
    }

    function debt() public override view returns (uint256) {
        return principal.add(interest);
    }

    /**
     * @dev Check how much was already repaid
     * Funds stored on the contract's address plus funds already redeemed by lenders
     * @return Uint256 representing what value was already repaid
     */
    function tokenRepaid() public view returns (uint256) {
        return _tokenBalance().add(tokenRedeemed);
    }

    /**
     * @dev Public currency token balance function
     * @return token balance of this contract
     */
    function _tokenBalance() private view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Check whether an ongoing loan has been repaid in full
     * @return true if and only if this loan has been repaid
     */
    function isRepaid() public view returns (bool) {
        return tokenRepaid() >= debt();
    }

    /**
     * @dev Get coupon value of this loan token in token
     * This assumes the loan will be paid back on time, with interest
     * @return coupon value of holder's LoanTokens in tokens
     */
    function tokenValue(address holder) external override view returns (uint256) {
        uint256 holderLoanBalance = balanceOf(holder);
        uint256 duration = block.timestamp.sub(start);
        if (status == Status.Withdrawn && duration < term) {
            uint256 partialInterest = interest.mul(duration).div(term);
            return holderLoanBalance.mul(principal.add(partialInterest)).div(debt());
        }
        if (status == Status.Defaulted) {
            return holderLoanBalance.mul(_tokenBalance()).div(totalSupply());
        }
        return holderLoanBalance;
    }

    function decimals() public override view returns (uint8) {
        return uint8(token.decimals());
    }
}
