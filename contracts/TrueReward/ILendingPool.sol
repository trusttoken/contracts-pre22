// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

interface ILendingPool {
    function deposit(
        address _reserve,
        uint256 _amount,
        uint16 _referralCode
    ) external;

    function core() external view returns (address);
}
