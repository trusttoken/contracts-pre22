// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

import {IBorrowingMutex} from "../interface/IBorrowingMutex.sol";

contract MockBorrowingMutex is IBorrowingMutex, UpgradeableClaimable {
    mapping(address => address) public override locker;

    function initialize() external initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function lock(address borrower) external override {
        locker[borrower] = msg.sender;
    }

    function unlock(address borrower) external override {
        locker[borrower] = address(0);
    }

    function ban(address borrower) external override {
        locker[borrower] = address(1);
    }

    function isUnlocked(address borrower) public override view returns (bool) {
        return locker[borrower] == address(0);
    }

    function isBanned(address borrower) public override view returns (bool) {
        return locker[borrower] == address(1);
    }
}
