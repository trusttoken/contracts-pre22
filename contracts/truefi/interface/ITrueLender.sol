// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueLender {
    function value() external view returns (uint256);

    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external;
}
