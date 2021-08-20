// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IBorrowingMutex {
    function lock(address borrower, address _locker) external;

    function unlock(address borrower) external;
}
