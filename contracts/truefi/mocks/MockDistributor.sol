// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {QuadraticTrueDistributor} from "../distributors/QuadraticTrueDistributor.sol";

contract MockDistributor is QuadraticTrueDistributor {
    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal override pure returns (uint256) {
        return toBlock.sub(fromBlock).mul(PRECISION).mul(100);
    }
}
