// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {TrueDistributor} from "./TrueDistributor.sol";

contract FastTrueDistributor is TrueDistributor {
    constructor(uint256 _startingBlock, ERC20 _trustToken) public TrueDistributor(_startingBlock, _trustToken) {}

    function getDistributionFactor() public override pure returns (uint256) {
        return 1674871870358735349205214274168;
    }

    function getTotalBlocks() public override pure returns (uint256) {
        return 1170000;
    }
}
