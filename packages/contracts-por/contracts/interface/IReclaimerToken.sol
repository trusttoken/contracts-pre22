// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReclaimerToken {
    function reclaimToken(IERC20 token, address _to) external;

    function reclaimEther(address payable _to) external;
}
