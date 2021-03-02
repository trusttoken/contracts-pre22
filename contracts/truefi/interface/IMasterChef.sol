// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;
}
