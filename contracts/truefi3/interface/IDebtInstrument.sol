// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IDebtInstrument
 * @notice Represents debt in the TrueFi protocol
 * @dev This is the basic interface for representing Debt in TrueFi
 * This interface is meant to be extended to support different debt types
 *
 * An NFT represents some debt where:
 *  - Each debt has an owner and a borrower
 *  - The owner mints and funds a loan
 *  - The borrower can withdraw funds from the loan
 *  - The borrower calls repay() to pay back the loan
 *  - Repayments are withdrawable by the owner
 *  - Every DebtInstrument has an underlying token
 *  - Only principal debt is tracked
 *
 **/
interface IDebtInstrument is IERC721 {
    /// @dev The borrower address borrows and repays the loan
    function borrower(uint256 tokenId) external view returns (address);

    /// @dev The underlying token denominating the debt
    function token(uint256 tokenId) external view returns (IERC20);

    /// @dev Principal debt amount
    function principal(uint256 tokenId) external view returns (uint256);

    /// @dev Each debt has an expiration timestamp
    function expiry(uint256 tokenId) external view returns (uint256);

    /// @dev Borrower calls this function to borrow `amount` of tokens
    function borrow(uint256 tokenId, uint256 amount) external;

    /// @dev Borrower calls this function to repay `amount` of tokens
    function repay(uint256 tokenId, uint256 amount) external;

    /// @dev Owner funds a loan for `amount` and increases principal
    function fund(uint256 tokenId, uint256 amount) external;

    /// @dev Owner calls this function to withdraw `amount` of tokens
    function withdraw(uint256 tokenId, uint256 amount) external;

    /// @dev Mint a new DebtInstrument
    function mint(
        address _borrower,
        IERC20 _token,
        uint256 _expiry
    ) external;
}
