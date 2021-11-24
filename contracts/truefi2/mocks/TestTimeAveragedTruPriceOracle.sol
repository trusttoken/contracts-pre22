// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TimeAveragedTruPriceOracle} from "../oracles/TimeAveragedTruPriceOracle.sol";

contract TestTimeAveragedTruPriceOracle is TimeAveragedTruPriceOracle {
    function bufferSize() public pure override returns (uint16) {
        return 7 + 1;
    }
}
