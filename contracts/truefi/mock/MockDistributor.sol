// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {QuadraticTrueDistributor, IERC20} from "../distributors/QuadraticTrueDistributor.sol";

contract MockDistributor is QuadraticTrueDistributor {
    constructor(uint256 _startingBlock, IERC20 _token) public QuadraticTrueDistributor(_startingBlock, _token) {}

    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal override pure returns (uint256) {
        return toBlock.sub(fromBlock).mul(PRECISION).mul(100);
    }
}
