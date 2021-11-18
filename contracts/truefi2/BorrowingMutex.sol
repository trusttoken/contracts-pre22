// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";

contract BorrowingMutex is IBorrowingMutex, UpgradeableClaimable {
    address public constant UNLOCKED = address(0);
    address public constant BANNED = address(1);

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => address) public override locker;

    mapping(address => bool) public isAllowedToLock;

    // ======= STORAGE DECLARATION END ===========

    event LockerAllowed(address locker, bool isAllowed);

    event BorrowerLocked(address borrower, address locker);

    event BorrowerUnlocked(address borrower);

    event BorrowerBanned(address borrower);

    modifier onlyAllowedToLock() {
        require(isAllowedToLock[msg.sender], "BorrowingMutex: Sender is not allowed to lock borrowers");
        _;
    }

    modifier onlyLocker(address borrower) {
        require(locker[borrower] == msg.sender, "BorrowingMutex: Only locker is allowed");
        _;
    }

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function allowLocker(address _locker, bool isAllowed) external onlyOwner {
        isAllowedToLock[_locker] = isAllowed;
        emit LockerAllowed(_locker, isAllowed);
    }

    function lock(address borrower) external override onlyAllowedToLock {
        require(isUnlocked(borrower), "BorrowingMutex: Borrower is already locked");
        locker[borrower] = msg.sender;
        emit BorrowerLocked(borrower, msg.sender);
    }

    function unlock(address borrower) external override onlyLocker(borrower) {
        locker[borrower] = UNLOCKED;
        emit BorrowerUnlocked(borrower);
    }

    function ban(address borrower) external override onlyLocker(borrower) {
        locker[borrower] = BANNED;
        emit BorrowerBanned(borrower);
    }

    function isUnlocked(address borrower) public override view returns (bool) {
        return locker[borrower] == UNLOCKED;
    }

    function isBanned(address borrower) public override view returns (bool) {
        return locker[borrower] == BANNED;
    }
}
