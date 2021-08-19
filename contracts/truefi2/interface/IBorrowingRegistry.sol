// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IBorrowingRegistry {
    function borrowingStatus(address borrower) external returns (bool);

    function setBorrowingStatus(address borrower, bool status) external;
}
