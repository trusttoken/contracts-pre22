// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TimeAveragedBaseRateOracle} from "../TimeAveragedBaseRateOracle.sol";
import {SpotBaseRateOracle} from "../SpotBaseRateOracle.sol";

contract TestTimeAveragedBaseRateOracle is TimeAveragedBaseRateOracle {
    constructor(
        SpotBaseRateOracle _spotOracle,
        address _asset,
        uint256 _cooldownTime
    ) public TimeAveragedBaseRateOracle(_spotOracle, _asset, _cooldownTime) {}

    function bufferSize() public override pure returns (uint16) {
        return 7 + 1;
    }
}
