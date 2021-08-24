// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";

contract BorrowingMutex is IBorrowingMutex, UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => address) public locker;

    mapping(address => bool) public canLock;

    // ======= STORAGE DECLARATION END ===========

    event LockerAllowed(address locker, bool isAllowed);

    event BorrowerLocked(address borrower, address locker);

    event BorrowerUnlocked(address borrower, address locker);

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function allowLocker(address _locker, bool isAllowed) external onlyOwner {
        canLock[_locker] = isAllowed;
        emit LockerAllowed(_locker, isAllowed);
    }

    function lock(address borrower, address _locker) external override {
        require(canLock[msg.sender], "BorrowingMutex: Sender is not allowed to lock borrowers");
        require(isUnlocked(borrower), "BorrowingMutex: Borrower is already locked");
        locker[borrower] = _locker;
        emit BorrowerLocked(borrower, _locker);
    }

    function unlock(address borrower) external override {
        address _locker = locker[borrower];
        require(_locker == msg.sender, "BorrowingMutex: Only locker can unlock");
        locker[borrower] = address(0);
        emit BorrowerUnlocked(borrower, _locker);
    }

    function isUnlocked(address borrower) public override view returns (bool) {
        return locker[borrower] == address(0);
    }
}
