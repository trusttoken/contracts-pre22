// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IDebtInstrument} from "./interface/IDebtInstrument.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title DebtInstrument
 * @dev Basic implementation of DebtInstrument
 * This implementation creates a simple tracking of debt between
 * two parties. Interest is not tracked in this contract.
 * The account that mints a token can fund a loan which
 * increases principal. A borrower can borrow up to principal, and the
 * amount borrowed is tracked. On repayment, token owner balance is
 * increased. Borrwers cannot re-borrow funds after repayment
 */
contract DebtInstrument is IDebtInstrument, ERC721("DebtInstrument", "DEBT") {
    using SafeMath for uint256;

    constructor() public {}

    // Borrower address
    mapping(uint256 => address) public override borrower;

    // Underlying token
    mapping(uint256 => IERC20) public override token;

    // Debt expiration timestamp
    mapping(uint256 => uint256) public override expiry;

    // Maximum amount that can be borrowed
    mapping(uint256 => uint256) public override principal;

    // Amount borrowed
    mapping(uint256 => uint256) public borrowed;

    // Withdrawable balance for token owner
    mapping(uint256 => uint256) public ownerBalance;

    // Track next tokenID
    uint256 nextId;

    /// @dev Mint a new DebtInstrument
    function mint(
        address _borrower,
        IERC20 _token,
        uint256 _expiry
    ) public override {
        // setup variables
        borrower[nextId] = _borrower;
        token[nextId] = _token;
        expiry[nextId] = _expiry;
        // mint token using ERC721 standard
        _safeMint(msg.sender, nextId);
        nextId = nextId.add(1);
    }

    /// @dev Owner funds a loan for `amount` and increases principal
    function fund(uint256 tokenId, uint256 amount) external override {
        require(msg.sender == ownerOf(tokenId), "DebtInstrument: Only owner can fund debt.");
        principal[tokenId].add(amount);
        token[tokenId].transferFrom(msg.sender, address(this), amount);
    }

    /// @dev Borrower calls this function to borrow `amount` of tokens
    /// Increases amount borrowed. Cannot borrow more than principal
    function borrow(uint256 tokenId, uint256 amount) external override {
        require(msg.sender == borrower[tokenId], "DebtInstrument: Only borrower can borrow from debt.");
        borrowed[tokenId].add(amount);
        require(borrowed[tokenId] <= principal[tokenId]);

        token[tokenId].transfer(borrower[tokenId], amount);
    }

    /// @dev Borrower calls this function to repay `amount` of tokens
    /// Adds to owner balance. Only borrower can repay
    function repay(uint256 tokenId, uint256 amount) external override {
        require(msg.sender == borrower[tokenId], "DebtInstrument: Only borrower can repay debt.");
        ownerBalance[tokenId].add(amount);

        token[tokenId].transferFrom(borrower[tokenId], address(this), amount);
    }

    /// @dev Owner calls this function to withdraw `amount` of tokens
    /// Decreases owner balance
    function withdraw(uint256 tokenId, uint256 amount) external override {
        require(msg.sender == ownerOf(tokenId), "Only owner can withdraw balance.");
        require(amount <= ownerBalance[tokenId]);

        ownerBalance[tokenId].sub(amount);

        token[tokenId].transfer(ownerOf(tokenId), amount);
    }
}
