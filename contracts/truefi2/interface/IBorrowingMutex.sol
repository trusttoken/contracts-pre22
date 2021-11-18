// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IBorrowingMutex {
    function lock(address borrower) external;

    function unlock(address borrower) external;

    function ban(address borrower) external;

    function locker(address borrower) external view returns (address);

    function isUnlocked(address borrower) external view returns (bool);

    function isBanned(address borrower) external view returns (bool);
}
