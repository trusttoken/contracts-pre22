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
        require(canLock[msg.sender], "BorrowingRegistry: Sender is not allowed to lock borrowers");
        locker[borrower] = _locker;
        emit BorrowerLocked(borrower, _locker);
    }

    function unlock(address borrower) external override {
        address _locker = locker[borrower];
        require(canLock[msg.sender] || _locker == msg.sender, "BorrowingRegistry: Only locker or allowed addresses can unlock");
        locker[borrower] = address(0);
        emit BorrowerUnlocked(borrower, _locker);
    }
}
