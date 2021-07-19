// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCreditLine} from "../TrueCreditLine.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";

/**
 * @dev Helper contract to test TrueCreditLine transfers
 */
contract TestTrueCreditLine is TrueCreditLine {
    constructor(
        address _creditAgency,
        address _borrower,
        ITrueFiPool2 _pool,
        uint256 _principalDebt
    ) public TrueCreditLine(_creditAgency, _borrower, _pool, _principalDebt) {}

    function mint(address to, uint256 amount) external {
        principalDebt = principalDebt.add(amount);
        _mint(to, amount);
    }
}
