// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ICurveMinter} from "../interface/ICurve.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCurveMinter is ICurveMinter {
    function mint(address gauge) external override {}

    function token() external override view returns (IERC20) {
        return IERC20(address(0));
    }
}
