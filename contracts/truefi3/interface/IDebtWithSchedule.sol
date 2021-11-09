// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

/**
 * @title Debt With Schedule
 * @notice TrueFi Debt Instrument with Payment Schedule
 * @dev An NFT which stores an expected schedule of payment
 * Calling the repay() function should store time and amount of payments
 * An implementation should take in a schedule which is an array
 * of information about expected payment times and amounts
 **/
interface IDebtWithSchedule {
    // store payment and schedule data
    struct Payment {
        // time of payment
        uint256 timestamp;
        // payment amount
        uint256 amount;
    }

    /// @dev Get expected schedule of payments
    function schedule(uint256 tokenId) external view returns (Payment[] memory);

    /// @dev Get history of actual payments
    function payments(uint256 tokenId) external view returns (Payment[] memory);
}
