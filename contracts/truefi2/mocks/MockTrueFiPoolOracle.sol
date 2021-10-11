// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../interface/ITrueFiPoolOracle.sol";

contract MockTrueFiPoolOracle is ITrueFiPoolOracle {
    IERC20WithDecimals private _token;

    constructor(IERC20WithDecimals __token) public {
        _token = __token;
    }

    function token() external override view returns (IERC20WithDecimals) {
        return _token;
    }

    function truToUsd(uint256 truAmount) external override view returns (uint256) {
        return (truAmount * 1e10) / 4;
    }

    function tokenToTru(uint256 tokenAmount) external override view returns (uint256) {
        return (tokenAmount * 4 * 10**8) / 10**_token.decimals();
    }

    function truToToken(uint256 truAmount) external override view returns (uint256) {
        return (truAmount * 1e10) / 4 / 10**(18 - _token.decimals());
    }

    function tokenToUsd(uint256 tokenAmount) external override view returns (uint256) {
        return tokenAmount * 10**(18 - _token.decimals());
    }
}
