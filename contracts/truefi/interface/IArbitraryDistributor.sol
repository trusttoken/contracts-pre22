// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IArbitraryDistributor {
    function amount() external returns (uint256);

    function remaining() external returns (uint256);

    function beneficiary() external returns (address);

    function distribute(uint256 _amount) external;

    function empty() external;
}
