// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract BorrowingRegistry is UpgradeableClaimable {
    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }
}
