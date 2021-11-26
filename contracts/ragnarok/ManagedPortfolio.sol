// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ECDSA} from "@openzeppelin/contracts4/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts4/token/ERC20/ERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts4/token/ERC721/IERC721Receiver.sol";
import {Manageable} from "./Manageable.sol";
import {BulletLoans, LoanStatus, GRACE_PERIOD} from "./BulletLoans.sol";
import {PortfolioConfig} from "./PortfolioConfig.sol";
import {BP, BPMath} from "./types/BP.sol";

interface IERC20WithDecimals is IERC20 {
    function decimals() external view returns (uint256);
}

contract ManagedPortfolio is IERC721Receiver, ERC20, Manageable {
    using BPMath for BP;
    using ECDSA for bytes32;

    IERC20WithDecimals public underlyingToken;
    BulletLoans public bulletLoans;
    PortfolioConfig public portfolioConfig;
    uint256 public endDate;
    uint256 public maxSize;
    uint256 public totalDeposited;
    BP public managerFee;
    bytes32 public hashedDepositMessage;
    mapping(uint256 => LoanStatus) public loanStatus;

    event BulletLoanCreated(uint256 id);

    event ManagerFeeChanged(BP newManagerFee);

    event LoanStatusChanged(uint256 id, LoanStatus newStatus);

    constructor(
        IERC20WithDecimals _underlyingToken,
        BulletLoans _bulletLoans,
        PortfolioConfig _portfolioConfig,
        uint256 _duration,
        uint256 _maxSize,
        BP _managerFee,
        string memory _depositMessage
    ) ERC20("ManagerPortfolio", "MPS") {
        underlyingToken = _underlyingToken;
        bulletLoans = _bulletLoans;
        portfolioConfig = _portfolioConfig;
        endDate = block.timestamp + _duration;
        maxSize = _maxSize;
        managerFee = _managerFee;
        hashedDepositMessage = keccak256(bytes(_depositMessage));
    }

    function deposit(uint256 depositAmount, bytes memory metadata) external {
        totalDeposited += depositAmount;
        require(totalDeposited <= maxSize, "ManagedPortfolio: Portfolio is full");
        require(block.timestamp < endDate, "ManagedPortfolio: Cannot deposit after portfolio end date");
        require(isSignatureValid(msg.sender, metadata), "ManagedPortfolio: Signature is invalid");

        _mint(msg.sender, getAmountToMint(depositAmount));
        underlyingToken.transferFrom(msg.sender, address(this), depositAmount);
    }

    function setManagerFee(BP _managerFee) external onlyManager {
        managerFee = _managerFee;
        emit ManagerFeeChanged(_managerFee);
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
    ) public onlyManager {
        require(block.timestamp < endDate, "ManagedPortfolio: Portfolio end date is in the past");
        require(
            block.timestamp + loanDuration + GRACE_PERIOD <= endDate,
            "ManagedPortfolio: Loan end date is greater than Portfolio end date"
        );
        uint256 managersPart = managerFee.mul(principalAmount).normalize();
        uint256 protocolsPart = portfolioConfig.protocolFee().mul(principalAmount).normalize();
        underlyingToken.transfer(borrower, principalAmount);
        underlyingToken.transfer(manager, managersPart);
        underlyingToken.transfer(portfolioConfig.protocolAddress(), protocolsPart);
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

    function setMaxSize(uint256 _maxSize) external onlyManager {
        maxSize = _maxSize;
    }

    function isSignatureValid(address signer, bytes memory signature) public view returns (bool) {
        address recovered = hashedDepositMessage.toEthSignedMessageHash().recover(signature);
        return recovered == signer;
    }

    function markLoanAsDefaulted(uint256 id) public onlyManager {
        require(loanStatus[id] != LoanStatus.Defaulted, "ManagedPortfolio: Loan is already defaulted");
        _changeLoanStatus(id, LoanStatus.Defaulted);
    }

    function markLoanAsActive(uint256 id) public onlyManager {
        require(loanStatus[id] != LoanStatus.Active, "ManagedPortfolio: Loan is already active");
        _changeLoanStatus(id, LoanStatus.Active);
    }

    function _changeLoanStatus(uint256 id, LoanStatus status) private {
        loanStatus[id] = status;
        emit LoanStatusChanged(id, status);
    }
}
