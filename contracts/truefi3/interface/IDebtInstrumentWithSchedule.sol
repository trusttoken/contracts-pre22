// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {IDebtInstrument} from "./IDebtInstrument.sol";

/**
 * @title Debt Instrument With Schedule
 * @notice TrueFi Debt Instrument with Payment Schedule
 * @dev
 * 
 * This Debt Instrument stores an expected schedule of payment
 * Calling the repay() function should store time and amount of payments
 * Minting the token should pass in a schedule which is an array
 * of information about expected payment times and amounts
 **/
interface IDebtInstrumentWithSchedule is IDebtInstrument {
	// store payment and schedule data
	struct Payment {
		// time of payment
		uint256 timestamp;
		// payment amount
		uint256 amount;
	}

	/// @dev Get expected schedule of payments
	function schedule() external view returns (Payment[] memory);

	/// @dev Get history of actual payments
	function payments() external view returns (Payment[] memory);
}