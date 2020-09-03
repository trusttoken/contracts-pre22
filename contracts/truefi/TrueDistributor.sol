// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

contract TrueDistributor {
    using SafeMath for uint256;

    uint256 public constant TOTAL_BLOCKS = 1e7;
    uint256 public constant PRECISION = 1e33;

    function squareSumTimes6(uint256 n) internal pure returns (uint256) {
        return n.mul(n.add(1)).mul(n.mul(2).add(1));
    }

    function reward(uint256 fromBlock, uint256 toBlock) public pure returns (uint256) {
        return
            squareSumTimes6(TOTAL_BLOCKS.sub(fromBlock)).sub(squareSumTimes6(TOTAL_BLOCKS.sub(toBlock))).mul(
                26824995976250469437449703116
            );
    }
}
