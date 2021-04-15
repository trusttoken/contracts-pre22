// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ILoanToken2, ITrueFiPool2} from "./interface/ILoanToken2.sol";
import {LoanToken} from "../truefi/LoanToken.sol";

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
 * Loan progresses through the following states:
 * Awaiting:    Waiting for funding to meet capital requirements
 * Funded:      Capital requirements met, borrower can withdraw
 * Withdrawn:   Borrower withdraws money, loan waiting to be repaid
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 * Liquidated:  Loan has Defaulted and stakers have been Liquidated
 *
 * - LoanTokens are non-transferable except for whitelisted addresses
 * - This version of LoanToken only supports a single funder
 */
contract LoanToken2 is ILoanToken2, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint128 public constant lastMinutePaybackDuration = 1 days;

    address public override borrower;
    address public liquidator;
    uint256 public override amount;
    uint256 public override term;
    uint256 public override apy;

    uint256 public override start;
    address public override lender;
    uint256 public override debt;

    uint256 public redeemed;

    // whitelist for transfers
    mapping(address => bool) public canTransfer;

    Status public override status;

    IERC20 public override token;

    ITrueFiPool2 public override pool;

    /**
     * @dev Emitted when the loan is funded
     * @param lender Address which funded the loan
     */
    event Funded(address lender);

    /**
     * @dev Emitted when transfer whitelist is updated
     * @param account Account to whitelist for transfers
     * @param status New whitelist status
     */
    event TransferAllowanceChanged(address account, bool status);

    /**
     * @dev Emitted when borrower withdraws funds
     * @param beneficiary Account which will receive funds
     */
    event Withdrawn(address beneficiary);

    /**
     * @dev Emitted when loan has been fully repaid
     * @param returnedAmount Amount that was returned
     */
    event Settled(uint256 returnedAmount);

    /**
     * @dev Emitted when term is over without full repayment
     * @param returnedAmount Amount that was returned before expiry
     */
    event Defaulted(uint256 returnedAmount);

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
     * @dev Emitted when borrower reclaims remaining tokens
     * @param borrower Receiver of remaining tokens
     * @param reclaimedAmount Amount of tokens repaid
     */
    event Reclaimed(address borrower, uint256 reclaimedAmount);

    /**
     * @dev Emitted when loan gets liquidated
     * @param status Final loan status
     */
    event Liquidated(Status status);

    /**
     * @dev Create a Loan
     * @param _pool Pool to lend from
     * @param _borrower Borrower address
     * @param _lender Lender address
     * @param _liquidator Liquidator address
     * @param _amount Borrow amount of loaned tokens
     * @param _term Loan length
     * @param _apy Loan APY
     */
    constructor(
        ITrueFiPool2 _pool,
        address _borrower,
        address _lender,
        address _liquidator,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) public ERC20("TrueFi Loan Token", "LOAN") {
        require(_lender != address(0), "LoanToken2: Lender is not set");

        pool = _pool;
        token = _pool.token();
        borrower = _borrower;
        liquidator = _liquidator;
        amount = _amount;
        term = _term;
        apy = _apy;
        lender = _lender;
        debt = interest(amount);
    }

    /**
     * @dev Only borrower can withdraw & repay loan
     */
    modifier onlyBorrower() {
        require(msg.sender == borrower, "LoanToken2: Caller is not the borrower");
        _;
    }

    /**
     * @dev Only liquidator can liquidate
     */
    modifier onlyLiquidator() {
        require(msg.sender == liquidator, "LoanToken2: Caller is not the liquidator");
        _;
    }

    /**
     * @dev Only after loan has been closed: Settled, Defaulted, or Liquidated
     */
    modifier onlyAfterClose() {
        require(status >= Status.Settled, "LoanToken2: Only after loan has been closed");
        _;
    }

    /**
     * @dev Only when loan is Funded
     */
    modifier onlyOngoing() {
        require(status == Status.Funded || status == Status.Withdrawn, "LoanToken2: Current status should be Funded or Withdrawn");
        _;
    }

    /**
     * @dev Only when loan is Funded
     */
    modifier onlyFunded() {
        require(status == Status.Funded, "LoanToken2: Current status should be Funded");
        _;
    }

    /**
     * @dev Only when loan is Withdrawn
     */
    modifier onlyAfterWithdraw() {
        require(status >= Status.Withdrawn, "LoanToken2: Only after loan has been withdrawn");
        _;
    }

    /**
     * @dev Only when loan is Awaiting
     */
    modifier onlyAwaiting() {
        require(status == Status.Awaiting, "LoanToken2: Current status should be Awaiting");
        _;
    }

    /**
     * @dev Only when loan is Defaulted
     */
    modifier onlyDefaulted() {
        require(status == Status.Defaulted, "LoanToken2: Current status should be Defaulted");
        _;
    }

    /**
     * @dev Only whitelisted accounts or lender
     */
    modifier onlyWhoCanTransfer(address sender) {
        require(
            sender == lender || canTransfer[sender],
            "LoanToken2: This can be performed only by lender or accounts allowed to transfer"
        );
        _;
    }

    /**
     * @dev Only lender can perform certain actions
     */
    modifier onlyLender() {
        require(msg.sender == lender, "LoanToken2: This can be performed only by lender");
        _;
    }

    /**
     * @dev Get loan parameters
     * @return amount, term, apy
     */
    function getParameters()
        external
        override
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
     * @param _balance number of LoanTokens to get value for
     * @return coupon value of _balance LoanTokens in tokens
     */
    function value(uint256 _balance) external override view returns (uint256) {
        if (_balance == 0) {
            return 0;
        }

        uint256 passed = block.timestamp.sub(start);
        if (passed > term || status == Status.Settled) {
            passed = term;
        }

        // assume year is 365 days
        uint256 interest = amount.mul(apy).mul(passed).div(365 days).div(10000);

        return amount.add(interest).mul(_balance).div(debt);
    }

    /**
     * @dev Fund a loan
     * Set status, start time, lender
     */
    function fund() external override onlyAwaiting onlyLender {
        status = Status.Funded;
        start = block.timestamp;
        _mint(msg.sender, debt);
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Funded(msg.sender);
    }

    /**
     * @dev Whitelist accounts to transfer
     * @param account address to allow transfers for
     * @param _status true allows transfers, false disables transfers
     */
    function allowTransfer(address account, bool _status) external override onlyLender {
        canTransfer[account] = _status;
        emit TransferAllowanceChanged(account, _status);
    }

    /**
     * @dev Borrower calls this function to withdraw funds
     * Sets the status of the loan to Withdrawn
     * @param _beneficiary address to send funds to
     */
    function withdraw(address _beneficiary) external override onlyBorrower onlyFunded {
        status = Status.Withdrawn;
        token.safeTransfer(_beneficiary, amount);

        emit Withdrawn(_beneficiary);
    }

    /**
     * @dev Settle the loan after checking it has been repaid
     */
    function settle() public override onlyOngoing {
        require(isRepaid(), "LoanToken2: loan must be repaid to settle");
        status = Status.Settled;
        emit Settled(_balance());
    }

    /**
     * @dev Default the loan if it has not been repaid by the end of term
     */
    function enterDefault() external override onlyOngoing {
        require(!isRepaid(), "LoanToken2: cannot default a repaid loan");
        require(start.add(term).add(lastMinutePaybackDuration) <= block.timestamp, "LoanToken2: Loan cannot be defaulted yet");
        status = Status.Defaulted;
        emit Defaulted(_balance());
    }

    /**
     * @dev Liquidate the loan if it has defaulted
     */
    function liquidate() external override onlyDefaulted onlyLiquidator {
        status = Status.Liquidated;

        emit Liquidated(status);
    }

    /**
     * @dev Redeem LoanToken balances for underlying token
     * Can only call this function after the loan is Closed
     * @param _amount amount to redeem
     */
    function redeem(uint256 _amount) external override onlyAfterClose {
        uint256 amountToReturn = _amount.mul(_balance()).div(totalSupply());
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
    function repay(address _sender, uint256 _amount) external override {
        _repay(_sender, _amount);
    }

    /**
     * @dev Function for borrower to repay all of the remaining loan balance
     * Borrower should use this to ensure full repayment
     * @param _sender account sending token to repay
     */
    function repayInFull(address _sender) external override {
        _repay(_sender, debt.sub(_balance()));
    }

    /**
     * @dev Internal function for loan repayment
     * If _amount is sufficient, then this also settles the loan
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function _repay(address _sender, uint256 _amount) internal onlyAfterWithdraw {
        require(_amount <= debt.sub(_balance()), "LoanToken2: Cannot repay over the debt");
        emit Repaid(_sender, _amount);

        token.safeTransferFrom(_sender, address(this), _amount);
        if (isRepaid()) {
            settle();
        }
    }

    /**
     * @dev Function for borrower to reclaim stuck token
     * Can only call this function after the loan is Closed
     * and all of LoanToken holders have been burnt
     */
    function reclaim() external override onlyAfterClose onlyBorrower {
        require(totalSupply() == 0, "LoanToken2: Cannot reclaim when LoanTokens are in circulation");
        uint256 balanceRemaining = _balance();
        require(balanceRemaining > 0, "LoanToken2: Cannot reclaim when balance 0");

        token.safeTransfer(borrower, balanceRemaining);
        emit Reclaimed(borrower, balanceRemaining);
    }

    /**
     * @dev Check how much was already repaid
     * Funds stored on the contract's address plus funds already redeemed by lenders
     * @return Uint256 representing what value was already repaid
     */
    function repaid() external override view onlyAfterWithdraw returns (uint256) {
        return _balance().add(redeemed);
    }

    /**
     * @dev Check whether an ongoing loan has been repaid in full
     * @return true if and only if this loan has been repaid
     */
    function isRepaid() public override view onlyOngoing returns (bool) {
        return _balance() >= debt;
    }

    /**
     * @dev Public currency token balance function
     * @return token balance of this contract
     */
    function balance() external override view returns (uint256) {
        return _balance();
    }

    /**
     * @dev Get currency token balance for this contract
     * @return token balance of this contract
     */
    function _balance() internal view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Calculate interest that will be paid by this loan for an amount (returned funds included)
     * amount + ((amount * apy * term) / (365 days / precision))
     * @param _amount amount
     * @return uint256 Amount of interest paid for _amount
     */
    function interest(uint256 _amount) internal view returns (uint256) {
        return _amount.add(_amount.mul(apy).mul(term).div(365 days).div(10000));
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
    ) internal override onlyWhoCanTransfer(sender) {
        return super._transfer(sender, recipient, _amount);
    }

    function version() external override pure returns (uint8) {
        return 4;
    }
}
