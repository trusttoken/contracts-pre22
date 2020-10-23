// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {CurveTrueDistributor, IERC20} from "../distributors/CurveTrueDistributor.sol";

contract MockDistributor is CurveTrueDistributor {
    constructor(uint256 _startingBlock, IERC20 _token) public CurveTrueDistributor(_startingBlock, _token) {}

    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal override pure returns (uint256) {
        return toBlock.sub(fromBlock).mul(PRECISION).mul(100);
    }
}
