// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IPoolFactory {
    function isPool(address pool) external view returns (bool);
}
