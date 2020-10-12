// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";

contract LoanToken is ILoanToken, ERC20 {
    using SafeMath for uint256;

    address public override borrower;
    uint256 public override amount;
    uint256 public override duration;
    uint256 public override apy;

    uint256 public start;
    uint256 public debt;

    uint256 public redeemed;

    Status public status;

    IERC20 public currencyToken;

    event Funded(address funder);
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
        require(msg.sender == borrower, "LoanToken: caller is not the borrower");
        _;
    }

    modifier onlyClosed() {
        require(status == Status.Settled || status == Status.Defaulted, "LoanToken: current status should be Settled or Defaulted");
        _;
    }

    modifier onlyOngoing() {
        require(status == Status.Funded || status == Status.Withdrawn, "LoanToken: current status should be Funded or Withdrawn");
        _;
    }

    modifier onlyFunded() {
        require(status == Status.Funded, "LoanToken: current status should be Funded");
        _;
    }

    modifier onlyAfterWithdraw() {
        require(status >= Status.Withdrawn, "LoanToken: only after loan has been withdrawn");
        _;
    }

    modifier onlyAwaiting() {
        require(status == Status.Awaiting, "LoanToken: current status should be Awaiting");
        _;
    }

    function isLoanToken() external override pure returns (bool) {
        return true;
    }

    function fund() external override onlyAwaiting {
        status = Status.Funded;
        start = block.timestamp;
        _mint(msg.sender, debt);
        require(currencyToken.transferFrom(msg.sender, address(this), amount));

        emit Funded(msg.sender);
    }

    function withdraw(address _beneficiary) external override onlyBorrower onlyFunded {
        status = Status.Withdrawn;
        require(currencyToken.transfer(_beneficiary, amount));

        emit Withdrawn(_beneficiary);
    }

    function close() external override onlyOngoing {
        require(start.add(duration) <= block.timestamp, "LoanToken: loan cannot be closed yet");
        if (_balance() >= debt) {
            status = Status.Settled;
        } else {
            status = Status.Defaulted;
        }

        emit Closed(status, _balance());
    }

    function redeem(uint256 _amount) external override onlyClosed {
        uint256 amountToReturn = _amount.mul(_balance()).div(totalSupply());
        redeemed = redeemed.add(amountToReturn);
        _burn(msg.sender, _amount);
        require(currencyToken.transfer(msg.sender, amountToReturn));

        emit Redeemed(msg.sender, _amount, amountToReturn);
    }

    function repay(address _sender, uint256 _amount) external override onlyAfterWithdraw {
        require(currencyToken.transferFrom(_sender, address(this), _amount));
    }

    function repaid() external override view onlyAfterWithdraw returns (uint256) {
        return _balance().add(redeemed);
    }

    function balance() external override view returns (uint256) {
        return _balance();
    }

    function _balance() internal view returns (uint256) {
        return currencyToken.balanceOf(address(this));
    }

    function interest(uint256 _amount) internal view returns (uint256) {
        return _amount.add(_amount.mul(apy).mul(duration).div(360 days).div(10000));
    }
}
