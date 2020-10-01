// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILoanToken} from "./interface/ILoanToken.sol";

/**
 * @title LoanToken
 * @dev Lend ERC20 tokens for a length of time with interest
 *
 * Create undercollateralized loans with LoanTokens representing
 * stake in the paid back loan after expiration
 */
contract LoanToken is ILoanToken, ERC20, Ownable {
    using SafeMath for uint256;

    address public borrower;
    uint256 public principal;
    uint256 public length;
    uint256 public rate;
    uint256 public expiry;
    bool public approved;
    IERC20 public token;

    constructor(
        address _borrower,
        uint256 _principal,
        uint256 _length,
        uint256 _rate
    ) public ERC20("Loan Token", "LOAN") {
        borrower = _borrower;
        principal = _principal;
        expiry = _length;
        rate = _rate;
    }

    /// get balance of deposit tokens
    function balance() public override view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// calculate interest given amount
    function interest(uint256 amount) internal view returns (uint256) {
        return amount.add(amount.mul(rate).div(10**18));
    }

    /// get value of principal plus interest
    function value() public override view returns (uint256) {
        return interest(principal);
    }

    /// transfer deposit tokens to this contract and mint loan tokens
    function deposit(uint256 amount) public override {
        require(!approved, "cannot deposit: loan approved");
        // if depositor sends too much, only deposit amount needed
        if (balance().add(amount) > principal) {
            amount = principal.sub(balance());
        }
        token.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }

    /// redeem and burn loan tokens, withdraw tokens
    function redeem(uint256 amount) public override {
        require(block.timestamp >= expiry, "cannot redeem: before expiry");
        require(approved, "cannot redeem: loan not approved");
        _burn(msg.sender, amount);
        token.transfer(msg.sender, interest(amount));
    }

    /// approve loan, set approved, set expiry, transfer funds
    function approve() public override onlyOwner {
        require(!approved, "cannot approve: loan approved");
        approved = true;
    }

    /// borrower can call this function to borrow approved funds
    function borrow() public override {
        require(msg.sender == borrower, "only borrower");
        require(approved, "must be approved to borrow");
        expiry = block.timestamp.add(length);
    }

    /// pay back loan in full
    function pay() public override {
        require(approved, "cannot pay: loan approved");
        token.transferFrom(msg.sender, address(this), interest(principal));
    }
}
