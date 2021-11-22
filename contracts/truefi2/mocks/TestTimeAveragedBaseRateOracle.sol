// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TimeAveragedBaseRateOracle} from "../TimeAveragedBaseRateOracle.sol";

contract TestTimeAveragedBaseRateOracle is TimeAveragedBaseRateOracle {
    function bufferSize() public pure override returns (uint16) {
        return 7 + 1;
    }
}
