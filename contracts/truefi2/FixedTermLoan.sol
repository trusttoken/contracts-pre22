// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {IFixedTermLoanAgency} from "./interface/IFixedTermLoanAgency.sol";
import {IFixedTermLoan} from "./interface/IFixedTermLoan.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";

/**
 * @title FixedTermLoan
 * @dev A token which represents share of a debt obligation
 *
 * Each Loan has:
 * - borrower address
 * - borrow principal
 * - loan term
 * - loan APY
 *
 * Loans initialize to a Withdrawn state, which can only transition to terminal states:
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 *
 * - This version of FixedTermLoan only supports a single funder
 */
contract FixedTermLoan is IFixedTermLoan, ERC20 {
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

    IFixedTermLoanAgency public ftlAgency;

    /**
     * @dev Emitted when a FixedTermLoan is repaid by the borrower in underlying tokens
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
     * @dev Emitted when a loan is redeemed for underlying tokens
     * @param receiver Receiver of tokens
     * @param loanBurnedAmount Amount of tokens burned
     * @param tokenRedeemedAmount Amount of token received
     */
    event Redeemed(address receiver, uint256 loanBurnedAmount, uint256 tokenRedeemedAmount);

    /**
     * @dev Create a Loan
     * @param _pool Pool to lend from
     * @param _mutex Mutex to release/block borrower on loan closure
     * @param _borrower Borrower address
     * @param _ftlAgency FixedTermLoanAgency address
     * @param _loanFactory LoanFactory to create DebtTokens in case of default
     * @param _creditOracle Oracle to check if loan reached end of term
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
        start = block.timestamp;
        term = _term;
        token = IERC20WithDecimals(address(_pool.token()));
        pool = _pool;
        borrowingMutex = _mutex;
        creditOracle = _creditOracle;
        loanFactory = _loanFactory;
        ftlAgency = _ftlAgency;

        _mint(address(_ftlAgency), debt());
    }

    /**
     * @dev Only when loan is Withdrawn
     */
    modifier onlyWithdrawn() {
        require(status == Status.Withdrawn, "FixedTermLoan: Status is not Withdrawn");
        _;
    }

    /**
     * @dev Only when loan is Settled or Defaulted
     */
    modifier onlySettledOrDefaulted() {
        require(status == Status.Settled || status == Status.Defaulted, "FixedTermLoan: Only after loan has been closed");
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
        _repay(_sender, unpaidDebt());
    }

    /**
     * @dev Internal function for loan repayment
     * If _amount is sufficient, then this also settles the loan
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function _repay(address _sender, uint256 _amount) private {
        require(_amount <= unpaidDebt(), "FixedTermLoan: Repay amount more than unpaid debt");

        token.safeTransferFrom(_sender, address(this), _amount);
        if (unpaidDebt() == 0) {
            settle();
        }
        emit Repaid(_sender, _amount);
    }

    /**
     * @dev Settle the loan after checking it has been repaid
     */
    function settle() public onlyWithdrawn {
        require(unpaidDebt() == 0, "FixedTermLoan: Loan must be fully repaid");
        status = Status.Settled;
        emit Settled(_tokenBalance());
    }

    /**
     * @dev Default the loan if it has not been repaid by the end of term
     */
    function enterDefault() external onlyWithdrawn {
        uint256 _unpaidDebt = unpaidDebt();
        require(_unpaidDebt > 0, "FixedTermLoan: Loan must not be fully repaid");
        require(start.add(term).add(creditOracle.gracePeriod()) <= block.timestamp, "FixedTermLoan: Loan has not reached end of term");
        status = Status.Defaulted;

        debtToken = loanFactory.createDebtToken(pool, borrower, _unpaidDebt);
        debtToken.safeApprove(address(pool), _unpaidDebt);
        pool.addDebt(debtToken, _unpaidDebt);

        borrowingMutex.ban(borrower);

        emit Defaulted(debtToken, _unpaidDebt);
    }

    /**
     * @dev Redeem FixedTermLoan balances for underlying token
     * Can only call this function after the loan is Closed
     */
    function redeem() external override onlySettledOrDefaulted {
        uint256 _totalSupply = totalSupply();
        require(_totalSupply > 0, "FixedTermLoan: Total token supply should be greater than 0");
        uint256 loanRedeemAmount = balanceOf(msg.sender);
        uint256 tokenRedeemAmount = loanRedeemAmount.mul(_tokenBalance()).div(_totalSupply);
        tokenRedeemed = tokenRedeemed.add(tokenRedeemAmount);

        if (address(ftlAgency) == msg.sender && status == Status.Settled) {
            borrowingMutex.unlock(borrower);
        }
        _burn(msg.sender, loanRedeemAmount);
        token.safeTransfer(msg.sender, tokenRedeemAmount);

        emit Redeemed(msg.sender, loanRedeemAmount, tokenRedeemAmount);
    }

    function debt() public override view returns (uint256) {
        return principal.add(interest);
    }

    function unpaidDebt() public view returns (uint256) {
        uint256 tokenRepaid = _tokenBalance().add(tokenRedeemed);
        uint256 _debt = debt();
        return tokenRepaid < _debt ? _debt.sub(tokenRepaid) : 0;
    }

    /**
     * @dev Public currency token balance function
     * @return token balance of this contract
     */
    function _tokenBalance() private view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Get current value of this loan for holder, denominated in underlying tokens
     * This assumes:
     * - the loan increases linearly in value from creation to maturity
     * - the loan will be paid back on time, with interest
     * @return current value of holder's loan in tokens
     */
    function currentValue(address holder) external override view returns (uint256) {
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
