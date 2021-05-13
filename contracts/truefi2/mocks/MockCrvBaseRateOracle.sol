// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {CrvBaseRateOracle} from "../CrvBaseRateOracle.sol";
import {ICurve} from "../../truefi/interface/ICurve.sol";

contract MockCrvBaseRateOracle is CrvBaseRateOracle {
    constructor(ICurve _curve, uint256 _cooldownTime) public CrvBaseRateOracle(_curve, _cooldownTime) {}

    function bufferSize() public override pure returns (uint16) {
        return 7;
    }
}
