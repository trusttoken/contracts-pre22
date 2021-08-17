// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ChainlinkTruOracle, IERC20WithDecimals} from "./ChainlinkTruOracle.sol";

contract ChainlinkTruUsdtOracle is ChainlinkTruOracle {
    function token() public override view returns (IERC20WithDecimals) {
        return IERC20WithDecimals(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    }

    /*
     * @dev assume price is always 1USD, convert 6 decimal places to 18
     */
    function tokenToUsd(uint256 tokenAmount) public override view returns (uint256) {
        return tokenAmount.mul(1e12);
    }
}
