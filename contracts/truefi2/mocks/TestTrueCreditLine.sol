// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCreditLine} from "../TrueCreditLine.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";

/**
 * @dev Helper contract to test TrueCreditLine transfers
 */
contract TestTrueCreditLine is TrueCreditLine {
    /**
     * @dev Create Credit Line
     * @param _borrower Borrower address
     * @param _pool Pool to which the credit line is attached to
     * @param _principalDebt Initial amount of debt taken by borrower
     */
    constructor(
        address _borrower,
        ITrueFiPool2 _pool,
        uint256 _principalDebt
    ) public TrueCreditLine(_borrower, _pool, _principalDebt) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
