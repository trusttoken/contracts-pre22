// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ILoanToken} from "./interface/ILoanToken.sol";

/**
 * @title LoanToken
 * @dev A token which represents share of a debt obligation
 * Each LoanToken has:
 * - borrower address
 * - borrow amount
 * - loan duration
 * - loan APY
 *
 * Loan progresses through the following states:
 * Awaiting:    Waiting for funding to meet capital requirements
 * Funded:      Capital requirements met, borrower can withdraw
 * Withdrawn:   Borrower withdraws money, loan waiting to be repaid
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 *
 * LoanTokens are non-transferrable except for whitelisted addresses
 */
contract LoanToken is ILoanToken, ERC20 {
    using SafeMath for uint256;

    address public override borrower;
    uint256 public override amount;
    uint256 public override duration;
    uint256 public override apy;

    uint256 public override start;
    address public override lender;
    uint256 public override debt;

    uint256 public redeemed;

    // whitelist for transfers
    mapping(address => bool) public canTransfer;

    Status public override status;

    IERC20 public currencyToken;

    event Funded(address lender);
    event TransferAllowanceChanged(address account, bool status);
    event Withdrawn(address beneficiary);
    event Closed(Status status, uint256 returnedAmount);
    event Redeemed(address receiver, uint256 burnedAmount, uint256 redeemedAmound);

    constructor(
        IERC20 _currencyToken,
        address _borrower,
        uint256 _amount,
        uint256 _duration,
        uint256 _apy
    ) public ERC20("Loan Token", "LOAN") {
        currencyToken = _currencyToken;
        borrower = _borrower;
        amount = _amount;
        duration = _duration;
        apy = _apy;
        debt = interest(amount);
    }

    modifier onlyBorrower() {
        require(msg.sender == borrower, "LoanToken: Caller is not the borrower");
        _;
    }

    modifier onlyClosed() {
        require(status == Status.Settled || status == Status.Defaulted, "LoanToken: Current status should be Settled or Defaulted");
        _;
    }

    modifier onlyOngoing() {
        require(status == Status.Funded || status == Status.Withdrawn, "LoanToken: Current status should be Funded or Withdrawn");
        _;
    }

    modifier onlyFunded() {
        require(status == Status.Funded, "LoanToken: Current status should be Funded");
        _;
    }

    modifier onlyAfterWithdraw() {
        require(status >= Status.Withdrawn, "LoanToken: Only after loan has been withdrawn");
        _;
    }

    modifier onlyAwaiting() {
        require(status == Status.Awaiting, "LoanToken: Current status should be Awaiting");
        _;
    }

    modifier onlyWhoCanTransfer(address sender) {
        require(
            sender == lender || canTransfer[sender],
            "LoanToken: This can be performed only by lender or accounts allowed to transfer"
        );
        _;
    }

    modifier onlyLender() {
        require(msg.sender == lender, "LoanToken: This can be performed only by lender");
        _;
    }

    function isLoanToken() external override pure returns (bool) {
        return true;
    }

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
        return (amount, apy, duration);
    }

    /**
     * @dev Fund a loan
     * Set status, start time, lender
     */
    function fund() external override onlyAwaiting {
        status = Status.Funded;
        start = block.timestamp;
        lender = msg.sender;
        _mint(msg.sender, debt);
        require(currencyToken.transferFrom(msg.sender, address(this), amount));

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
        require(currencyToken.transfer(_beneficiary, amount));

        emit Withdrawn(_beneficiary);
    }

    /**
     * @dev Close the loan and check if it has been repaid
     */
    function close() external override onlyOngoing {
        require(start.add(duration) <= block.timestamp, "LoanToken: Loan cannot be closed yet");
        if (_balance() >= debt) {
            status = Status.Settled;
        } else {
            status = Status.Defaulted;
        }

        emit Closed(status, _balance());
    }

    /**
     * @dev Redeem LoanToken balances for underlying currencyToken
     * Can only call this function after the loan is Closed
     * @param _amount amount to redeem
     */
    function redeem(uint256 _amount) external override onlyClosed {
        uint256 amountToReturn = _amount.mul(_balance()).div(totalSupply());
        redeemed = redeemed.add(amountToReturn);
        _burn(msg.sender, _amount);
        require(currencyToken.transfer(msg.sender, amountToReturn));

        emit Redeemed(msg.sender, _amount, amountToReturn);
    }

    /**
     * @dev Function for borrower to repay the loan
     * Borrower can repay at any time
     * @param _sender account sending currencyToken to repay
     * @param _amount amount of currencyToken to repay
     */
    function repay(address _sender, uint256 _amount) external override onlyAfterWithdraw {
        require(currencyToken.transferFrom(_sender, address(this), _amount));
    }

    /**
     * @dev Check if loan has been repaid
     * @return Boolean representing whether the loan has been repaid or not
     */
    function repaid() external override view onlyAfterWithdraw returns (uint256) {
        return _balance().add(redeemed);
    }

    /**
     * @dev Public currency token balance function
     * @return currencyToken balance of this contract
     */
    function balance() external override view returns (uint256) {
        return _balance();
    }

    /**
     * @dev Get currency token balance for this contract
     * @return currencyToken balance of this contract
     */
    function _balance() internal view returns (uint256) {
        return currencyToken.balanceOf(address(this));
    }

    /**
     * @dev Calculate interest that will be paid by this loan for an amount
     * @param _amount amount
     * @return Amount of interest paid for _amount
     */
    function interest(uint256 _amount) internal view returns (uint256) {
        return _amount.add(_amount.mul(apy).mul(duration).div(360 days).div(10000));
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
}
