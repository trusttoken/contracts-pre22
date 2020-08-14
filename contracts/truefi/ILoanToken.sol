// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILoanToken is IERC20 {
    /// get balance of deposit tokens
    function balance() external view returns (uint256);

    /// calculate interest given amount
    //function interest(uint256 amount) internal view returns (uint256);

    /// get value of principal plus interest
    function value() external view returns (uint256);

    /// transfer deposit tokens to this contract and mint loan tokens
    function deposit(uint256 amount) external;

    /// redeem and burn loan tokens, withdraw tokens
    function redeem(uint256 amount) external;

    /// approve loan, set approved, set expiry, transfer funds
    function approve() external;

    /// borrower can call this function to borrow approved funds
    function borrow() external;

    /// pay back loan in full
    function pay() external;
}