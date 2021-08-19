// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract BorrowingRegistry is UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => bool) public canChangeBorrowingStatus;

    // ======= STORAGE DECLARATION END ===========

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function allowChangingBorrowingStatus(address allowedAddress) external onlyOwner {
        canChangeBorrowingStatus[allowedAddress] = true;
    }
}
