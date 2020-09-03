// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TrueDistributor is Ownable {
    using SafeMath for uint256;

    struct Farm {
        uint256 shares;
        uint256 lastDistributionBlock;
    }

    uint256 public constant DISTRIBUTION_FACTOR = 26824995976250469437449703116;
    uint256 public constant TOTAL_BLOCKS = 1e7;
    uint256 public constant PRECISION = 1e33;
    uint256 public constant TOTAL_SHARES = 1e7;

    ERC20 public token;
    uint256 public startingBlock;
    mapping(address => Farm) public farms;

    constructor(uint256 _startingBlock, ERC20 _token) public {
        startingBlock = _startingBlock;
        token = _token;
        farms[msg.sender].shares = TOTAL_SHARES;
    }

    function distribute(address farm) public {
        uint256 currentBlock = block.number;
        uint256 totalRewardForInterval = reward(farms[farm].lastDistributionBlock, currentBlock);

        farms[farm].lastDistributionBlock = currentBlock;

        uint256 farmsReward = totalRewardForInterval.mul(farms[farm].shares).div(TOTAL_SHARES);

        if (farmsReward == 0) {
            return;
        }

        token.transfer(farm, normaliseToTokenPrecision(farmsReward));
    }

    function normaliseToTokenPrecision(uint256 amount) public view returns (uint256) {
        uint256 tokenPrecision = token.decimals();
        return amount.mul(10**tokenPrecision).div(PRECISION);
    }

    function transfer(
        address fromFarm,
        address toFarm,
        uint256 sharesAmount
    ) public onlyOwner {
        farms[fromFarm].shares = farms[fromFarm].shares.sub(sharesAmount);
        farms[toFarm].shares = farms[toFarm].shares.add(sharesAmount);
    }

    function getShares(address farm) public view returns (uint256) {
        return farms[farm].shares;
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

    function squareSumTimes6(uint256 n) public pure returns (uint256) {
        return n.mul(n.add(1)).mul(n.mul(2).add(1));
    }
}
