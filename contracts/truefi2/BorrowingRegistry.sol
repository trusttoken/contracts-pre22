// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {IBorrowingRegistry} from "./interface/IBorrowingRegistry.sol";

contract BorrowingRegistry is IBorrowingRegistry, UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => bool) public override borrowingStatus;
    mapping(address => bool) public canChangeBorrowingStatus;

    // ======= STORAGE DECLARATION END ===========

    event BorrowingStatusChanged(address borrower, bool status);

    event AllowedToChangeBorrowingStatus(address allowedAddress, bool isAllowed);

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function setBorrowingStatus(address borrower, bool status) external override {
        require(canChangeBorrowingStatus[msg.sender] == true, "BorrowingRegistry: Caller is not allowed to change borrowing status");
        borrowingStatus[borrower] = status;
        emit BorrowingStatusChanged(borrower, status);
    }

    function allowChangingBorrowingStatus(address allowedAddress, bool isAllowed) external onlyOwner {
        canChangeBorrowingStatus[allowedAddress] = isAllowed;
        emit AllowedToChangeBorrowingStatus(allowedAddress, isAllowed);
    }
}
