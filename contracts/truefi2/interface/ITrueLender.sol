// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueLender {
    // @dev calculate overall value of the pools
    function value() external view returns (uint256);

    // @dev distribute a basket of tokens for exiting user
    function distribute(
        address recipient,
        uint256 numerator,
        uint256 denominator
    ) external;
}
