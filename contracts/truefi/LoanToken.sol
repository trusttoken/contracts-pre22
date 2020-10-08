// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";

contract LoanToken is ILoanToken, ERC20, Ownable {
    using SafeMath for uint256;

    enum LoanTokenStatus {Awaiting, Funded, Closed}

    address public borrower;
    uint256 public duration;
    uint256 public apy;
    uint256 public amount;

    uint256 public start;
    uint256 public debt;

    uint256 public returned;

    LoanTokenStatus status;

    IERC20 public currencyToken;

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
        require(msg.sender == borrower);
        _;
    }

    modifier onlyClosed() {
        require(status == LoanTokenStatus.Closed);
        _;
    }

    modifier onlyFunded() {
        require(status != LoanTokenStatus.Funded);
        _;
    }

    modifier onlyAwaiting() {
        require(status == LoanTokenStatus.Awaiting);
        _;
    }

    function isLoanToken() external override pure returns (bool) {
        return true;
    }

    function fund() external override onlyAwaiting returns (uint256) {
        status = LoanTokenStatus.Funded;
        start = block.timestamp;
        _mint(msg.sender, debt);
        require(currencyToken.transferFrom(msg.sender, address(this), amount));
        return debt;
    }

    function withdraw(address _beneficiary, uint256 _amount) external override onlyBorrower onlyFunded {
        require(currencyToken.transfer(_beneficiary, _amount));
    }

    function close() external override onlyFunded {
        require(start.add(duration) <= block.timestamp);
        status = LoanTokenStatus.Closed;
        returned = currencyToken.balanceOf(address(this));
    }

    function redeem(uint256 _amount) external override onlyClosed {
        uint256 amountToReturn = _amount.mul(returned).div(debt);
        _burn(msg.sender, _amount);
        require(currencyToken.transfer(msg.sender, amountToReturn));
    }

    function settled() external override view onlyClosed returns (bool) {
        return returned >= debt;
    }

    function balance() external override view returns (uint256) {
        return currencyToken.balanceOf(address(this));
    }

    function interest(uint256 _amount) internal view returns (uint256) {
        return _amount.add(_amount.mul(apy).mul(duration).div(360 days).div(10000));
    }
}
