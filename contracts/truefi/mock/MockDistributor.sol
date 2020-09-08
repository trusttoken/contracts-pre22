pragma solidity 0.6.10;

import { TrueDistributor, ERC20 } from  "../TrueDistributor.sol";

contract MockDistributor is TrueDistributor {
    constructor(uint256 _startingBlock, ERC20 _token) public TrueDistributor(_startingBlock, _token) {}

    function rewardFormula(uint256 fromBlock, uint256 toBlock) internal pure override returns (uint) {
        return toBlock.sub(fromBlock).mul(PRECISION);
    }
}
