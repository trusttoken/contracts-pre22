// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ChainlinkTruOracle, IERC20WithDecimals} from "./ChainlinkTruOracle.sol";

contract ChainlinkTruTusdOracle is ChainlinkTruOracle {
    function token() public override view returns (IERC20WithDecimals) {
        return IERC20WithDecimals(0x0000000000085d4780B73119b644AE5ecd22b376);
    }

    /*
     * @dev assume price is always 1USD, convert 18 decimal places to 18
     */
    function tokenToUsd(uint256 tokenAmount) public override view returns (uint256) {
        return tokenAmount;
    }
}
