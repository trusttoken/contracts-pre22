pragma solidity 0.6.10;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IDebtInstrument} from "./interface/IDebtInstrument.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FixedRateZeroCouponDebtInstrument is IDebtInstrument, ERC721 {
	// id => borrower
	mapping(uint256 => address) public override borrower;

	// id => token
	mapping(uint256 => IERC20) public override token;

	// id => expiry
	mapping(uint256 => uint256) public override expiry;

	// id => principal
	mapping(uint256 => uint256) public override principal;

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
    	expiry[nextId] = expiry;
    	// mint token using ERC721 standard
    	_safeMint(msg.sender, nextId);
    	nextId = nextId + 1;
    }

    /// @dev Principal debt amount
    function principal(uint256 tokenId) external override view returns (uint256) {
    	return 0;
    }

    /// @dev Borrower calls this function to borrow `amount` of tokens
    function borrow(uint256 tokenId, uint256 amount) external override {
    	return;
    }

    /// @dev Borrower calls this function to repay `amount` of tokens
    function repay(uint256 tokenId, uint256 amount) external override {
    	return;
    }

    /// @dev Owner funds a loan for `amount` and increases principal
    function fund(uint256 tokenId, uint256 amount) external override {
    	return;
    }

    /// @dev Owner calls this function to withdraw `amount` of tokens
    function withdraw(uint256 tokenId, uint256 amount) external override {
    	return;
    }
}