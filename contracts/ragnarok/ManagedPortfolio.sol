// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts4/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts4/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts4/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts4/access/Ownable.sol";
import {BulletLoans, GRACE_PERIOD} from "./BulletLoans.sol";

interface IERC20WithDecimals is IERC20 {
    function decimals() external view returns (uint256);
}

contract ManagedPortfolio is IERC721Receiver, ERC20, Ownable {
    IERC20WithDecimals public underlyingToken;
    BulletLoans public bulletLoans;
    uint256 public endDate;
    uint256 public maxSize;
    uint256 public totalDeposited;

    event BulletLoanCreated(uint256 id);

    constructor(
        IERC20WithDecimals _underlyingToken,
        BulletLoans _bulletLoans,
        uint256 _duration,
        uint256 _maxSize
    ) ERC20("ManagerPortfolio", "MPS") Ownable() {
        underlyingToken = _underlyingToken;
        bulletLoans = _bulletLoans;
        endDate = block.timestamp + _duration;
        maxSize = _maxSize;
    }

    function deposit(uint256 depositAmount) external {
        totalDeposited += depositAmount;
        require(totalDeposited <= maxSize, "ManagedPortfolio: Portfolio is full");
        require(block.timestamp < endDate, "ManagedPortfolio: Cannot deposit after portfolio end date");

        _mint(msg.sender, getAmountToMint(depositAmount));
        underlyingToken.transferFrom(msg.sender, address(this), depositAmount);
    }

    function getAmountToMint(uint256 amount) public view returns (uint256) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            return (amount * 10**decimals()) / (10**underlyingToken.decimals());
        } else {
            return (amount * _totalSupply) / value();
        }
    }

    function value() public view returns (uint256) {
        return underlyingToken.balanceOf(address(this));
    }

    function withdraw(uint256 sharesAmount) external returns (uint256) {
        require(isClosed(), "ManagedPortfolio: Cannot withdraw when Portfolio is not closed");
        uint256 liquidFunds = underlyingToken.balanceOf(address(this));
        uint256 amountToWithdraw = (sharesAmount * liquidFunds) / totalSupply();
        _burn(msg.sender, sharesAmount);
        underlyingToken.transfer(msg.sender, amountToWithdraw);
        return amountToWithdraw;
    }

    function createBulletLoan(
        uint256 loanDuration,
        address borrower,
        uint256 principalAmount,
        uint256 // repaymentAmount
    ) public onlyOwner {
        require(block.timestamp < endDate, "ManagedPortfolio: Portfolio end date is in the past");
        require(
            block.timestamp + loanDuration + GRACE_PERIOD <= endDate,
            "ManagedPortfolio: Loan end date is greater than Portfolio end date"
        );

        underlyingToken.transfer(borrower, principalAmount);
        uint256 loanId = bulletLoans.createLoan(underlyingToken);
        emit BulletLoanCreated(loanId);
    }

    function isClosed() public view returns (bool) {
        return block.timestamp > endDate;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function setMaxSize(uint256 _maxSize) external onlyOwner {
        maxSize = _maxSize;
    }
}
