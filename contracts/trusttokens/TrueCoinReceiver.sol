// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}
