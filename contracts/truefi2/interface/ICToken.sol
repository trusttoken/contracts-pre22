// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ICToken {
    function borrowRatePerBlock() external view returns (uint256);
}
