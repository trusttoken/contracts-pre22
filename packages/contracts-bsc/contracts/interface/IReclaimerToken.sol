// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IBEP20} from "./IBEP20.sol";

interface IReclaimerToken {
    function reclaimToken(IBEP20 token, address _to) external;

    function reclaimBNB(address payable _to) external;
}
