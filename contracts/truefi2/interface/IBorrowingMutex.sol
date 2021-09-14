// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IBorrowingMutex {
    enum Status {Unlocked, Banned}

    function lock(address borrower, address _locker) external;

    function unlock(address borrower) external;

    function isUnlocked(address borrower) external view returns (bool);

    function locker(address borrower) external view returns (address);
}
