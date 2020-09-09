// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueDistributor, ERC20} from "../TrueDistributor.sol";

contract MockDistributor is TrueDistributor {
    constructor(uint256 _startingBlock, ERC20 _token) public TrueDistributor(_startingBlock, _token) {}

    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal override pure returns (uint256) {
        return toBlock.sub(fromBlock).mul(PRECISION).mul(100);
    }
}
