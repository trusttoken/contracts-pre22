// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TrueDistributor is Ownable {
    using SafeMath for uint256;

    uint256 public constant DISTRIBUTION_FACTOR = 26824995976250469437449703116;
    uint256 public constant TOTAL_BLOCKS = 1e7;
    uint256 public constant PRECISION = 1e33;
    uint256 public constant TOTAL_SHARES = 1e7;

    uint256 public startingBlock;
    mapping(address => uint256) shares;

    constructor(uint256 _startingBlock) public {
        startingBlock = _startingBlock;
        shares[msg.sender] = TOTAL_SHARES;
    }

    function transfer(
        address fromFarm,
        address toFarm,
        uint256 sharesAmount
    ) public onlyOwner {
        shares[fromFarm] = shares[fromFarm].sub(sharesAmount);
        shares[toFarm] = shares[toFarm].add(sharesAmount);
    }

    function getShares(address farm) public view returns (uint256) {
        return shares[farm];
    }

    function reward(uint256 fromBlock, uint256 toBlock) public view returns (uint256) {
        require(fromBlock <= toBlock, "invalid interval");
        if (toBlock < startingBlock || fromBlock == toBlock) {
            return 0;
        }
        if (fromBlock < startingBlock) {
            fromBlock = startingBlock;
        }
        return
            squareSumTimes6(TOTAL_BLOCKS.sub(fromBlock.sub(startingBlock)))
                .sub(squareSumTimes6(TOTAL_BLOCKS.sub(toBlock.sub(startingBlock))))
                .mul(DISTRIBUTION_FACTOR);
    }

    function squareSumTimes6(uint256 n) internal pure returns (uint256) {
        return n.mul(n.add(1)).mul(n.mul(2).add(1));
    }
}
