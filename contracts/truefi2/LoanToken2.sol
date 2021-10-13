// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
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
 * - borrow amount
 * - loan term
 * - loan APY
 *
 * Loans initialize to a Withdrawn state, which can only transition to terminal states:
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 *
 * - LoanTokens are only transferable by ftlAgency
 * - This version of LoanToken only supports a single funder
 */
contract LoanToken2 is ILoanToken2, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IDebtToken;

    uint256 private constant APY_PRECISION = 10000;

    address public borrower;
    uint256 public overrride amount;
    uint256 public term;

    // apy precision: 10000 = 100%
    uint256 public apy;

    uint256 public start;
    uint256 public override debt;

    uint256 public redeemed;

    Status public override status;

    // TODO IERC20WithDecimals
    ERC20 public token;

    ITrueFiPool2 public override pool;

    IBorrowingMutex public borrowingMutex;

    IFixedTermLoanAgency public ftlAgency;

    ITrueFiCreditOracle public creditOracle;

    ILoanFactory2 public loanFactory;

    IDebtToken public debtToken;

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
     * @param burnedAmount Amount of LoanTokens burned
     * @param redeemedAmount Amount of token received
     */
    event Redeemed(address receiver, uint256 burnedAmount, uint256 redeemedAmount);

    /**
     * @dev Emitted when a LoanToken is repaid by the borrower in underlying tokens
     * @param repayer Sender of tokens
     * @param repaidAmount Amount of token repaid
     */
    event Repaid(address repayer, uint256 repaidAmount);

    /**
     * @dev Create a Loan
     * @param _pool Pool to lend from
     * @param _borrower Borrower address
     * @param _ftlAgency FixedTermLoanAgency address
     * @param _loanFactory LoanFactory to create DebtTokens in case of default
     * @param _amount Borrow amount of loaned tokens
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
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external initializer {
        ERC20.__ERC20_initialize("TrueFi Loan Token", "LOAN");

        pool = _pool;
        token = _pool.token();
        borrowingMutex = _mutex;
        borrower = _borrower;
        amount = _amount;
        term = _term;
        apy = _apy;
        ftlAgency = _ftlAgency;
        loanFactory = _loanFactory;
        creditOracle = _creditOracle;
        debt = interest(amount);
        status = Status.Withdrawn;
        start = block.timestamp;
        _mint(address(ftlAgency), debt);
    }

    /**
     * @dev Only when loan is Settled or Defaulted
     */
    modifier onlySettledOrDefaulted() {
        require(status == Status.Settled || status == Status.Defaulted, "LoanToken2: Only after loan has been closed");
        _;
    }

    /**
     * @dev Only when loan is Withdrawn
     */
    modifier onlyWithdrawn() {
        require(status == Status.Withdrawn, "LoanToken2: Current status should be Withdrawn");
        _;
    }

    /**
     * @dev Only ftlAgency can perform certain actions
     */
    modifier onlyFTLAgency() {
        require(msg.sender == address(ftlAgency), "LoanToken2: This can be performed only by ftlAgency");
        _;
    }

    /**
     * @dev Get loan parameters
     * @return amount, term, apy
     */
    function getParameters()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (amount, apy, term);
    }

    /**
     * @dev Get coupon value of this loan token in token
     * This assumes the loan will be paid back on time, with interest
     * @param _amount number of LoanTokens to get value for
     * @return coupon value of _amount LoanTokens in tokens
     */
    function value(uint256 _amount) external override view returns (uint256) {
        if (_amount == 0) {
            return 0;
        }

        if (status == Status.Defaulted) {
            return _amount.mul(balance()).div(totalSupply());
        }

        uint256 passed = block.timestamp.sub(start);
        if (passed > term || status == Status.Settled) {
            passed = term;
        }

        // assume year is 365 days
        uint256 interest = amount.mul(apy).mul(passed).div(365 days).div(APY_PRECISION);

        return amount.add(interest).mul(_amount).div(debt);
    }

    /**
     * @dev Settle the loan after checking it has been repaid
     */
    function settle() public onlyWithdrawn {
        require(isRepaid(), "LoanToken2: loan must be repaid to settle");
        status = Status.Settled;

        borrowingMutex.unlock(borrower);

        emit Settled(balance());
    }

    /**
     * @dev Default the loan if it has not been repaid by the end of term
     */
    function enterDefault() external onlyWithdrawn {
        require(!isRepaid(), "LoanToken2: cannot default a repaid loan");
        require(start.add(term).add(creditOracle.gracePeriod()) <= block.timestamp, "LoanToken2: Loan cannot be defaulted yet");
        status = Status.Defaulted;

        uint256 unpaidDebt = debt.sub(repaid());
        debtToken = loanFactory.createDebtToken(pool, borrower, unpaidDebt);

        debtToken.approve(address(pool), unpaidDebt);
        pool.addDebt(debtToken, unpaidDebt);

        borrowingMutex.ban(borrower);

        emit Defaulted(debtToken, unpaidDebt);
    }

    /**
     * @dev Redeem LoanToken balances for underlying token
     * Can only call this function after the loan is Closed
     * @param _amount amount to redeem
     */
    function redeem(uint256 _amount) external override onlySettledOrDefaulted {
        uint256 amountToReturn = _amount.mul(balance()).div(totalSupply());
        redeemed = redeemed.add(amountToReturn);
        _burn(msg.sender, _amount);
        token.safeTransfer(msg.sender, amountToReturn);

        emit Redeemed(msg.sender, _amount, amountToReturn);
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
        _repay(_sender, debt.sub(balance()));
    }

    /**
     * @dev Internal function for loan repayment
     * If _amount is sufficient, then this also settles the loan
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function _repay(address _sender, uint256 _amount) internal {
        require(_amount <= debt.sub(balance()), "LoanToken2: Cannot repay over the debt");
        emit Repaid(_sender, _amount);

        token.safeTransferFrom(_sender, address(this), _amount);
        if (isRepaid()) {
            settle();
        }
    }

    /**
     * @dev Check how much was already repaid
     * Funds stored on the contract's address plus funds already redeemed by lenders
     * @return Uint256 representing what value was already repaid
     */
    function repaid() public override view returns (uint256) {
        return balance().add(redeemed);
    }

    /**
     * @dev Check whether an ongoing loan has been repaid in full
     * @return true if and only if this loan has been repaid
     */
    function isRepaid() public view onlyWithdrawn returns (bool) {
        return balance() >= debt;
    }

    /**
     * @dev Public currency token balance function
     * @return token balance of this contract
     */
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Calculate interest that will be paid by this loan for an amount (returned funds included)
     * amount + ((amount * apy * term) / 365 days / precision)
     * @param _amount amount
     * @return uint256 Amount of interest paid for _amount
     */
    function interest(uint256 _amount) internal view returns (uint256) {
        return _amount.add(_amount.mul(apy).mul(term).div(365 days).div(APY_PRECISION));
    }

    /**
     * @dev get profit for this loan
     * @return profit for this loan
     */
    function profit() external override view returns (uint256) {
        return debt.sub(amount);
    }

    /**
     * @dev Override ERC20 _transfer so only whitelisted addresses can transfer
     * @param sender sender of the transaction
     * @param recipient recipient of the transaction
     * @param _amount amount to send
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 _amount
    ) internal override onlyFTLAgency {
        return super._transfer(sender, recipient, _amount);
    }

    function version() external pure returns (uint8) {
        return 7;
    }

    function decimals() public override view returns (uint8) {
        return token.decimals();
    }
}
