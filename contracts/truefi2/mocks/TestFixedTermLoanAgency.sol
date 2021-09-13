// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {FixedTermLoanAgency} from "../FixedTermLoanAgency.sol";
import {ILoanToken2} from "../interface/ILoanToken2.sol";

/**
 * @dev Helper contract to test distribute feature of the FixedTermLoanAgency
 */
contract TestFixedTermLoanAgency is FixedTermLoanAgency {
    function testTransferAllLoanTokens(ILoanToken2 loan, address recipient) external {
        _transferAllLoanTokens(loan, recipient);
    }
}
