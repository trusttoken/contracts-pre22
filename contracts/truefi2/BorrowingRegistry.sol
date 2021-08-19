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

    mapping(address => address) public hasLock;

    mapping(address => bool) public canLock;

    // ======= STORAGE DECLARATION END ===========

    event BorrowerLocked(address borrower, address lockingContract);

    event BorrowerUnlocked(address borrower, address unlockingContract);

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function allowLocking(address allowedAddress) external onlyOwner {
        canLock[allowedAddress] = true;
    }

    function lock(address borrower) external override {
        require(canLock[msg.sender], "BorrowingRegistry: Sender is not allowed to lock borrowers");
        require(hasLock[borrower] == address(0), "BorrowingRegistry: Borrower is already locked");
        hasLock[borrower] = msg.sender;
        emit BorrowerLocked(borrower, msg.sender);
    }

    function unlock(address borrower) external override {
        require(hasLock[borrower] == msg.sender, "BorrowingRegistry: Only address that locked borrower can unlock");
        hasLock[borrower] = address(0);
        emit BorrowerUnlocked(borrower, msg.sender);
    }
}
