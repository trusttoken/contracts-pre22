// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {QuadraticTrueDistributor} from "./QuadraticTrueDistributor.sol";

/**
 * @title SlowTrueDistributor
 * @notice Distribute TRU slowly in a quadratic fashion
 */
contract SlowTrueDistributor is QuadraticTrueDistributor {

    /**
     * @dev Get Distribution factor to be slow
     * @return distribution factor
     */
    function getDistributionFactor() public override pure returns (uint256) {
        return 19779088491850731219454123509;
    }

    /**
     * @dev Get total blocks for distribution
     * @return number of blocks for distribution
     */
    function getTotalBlocks() public override pure returns (uint256) {
        return 7410000;
    }
}
