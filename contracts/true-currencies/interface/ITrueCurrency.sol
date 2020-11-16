// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IHasOwner} from "./IHasOwner.sol";
import {IReclaimerToken} from "./IReclaimerToken.sol";

interface ITrueCurrency is IERC20, IReclaimerToken, IHasOwner {
    function refundGas(uint256 amount) external;

    function setBlacklisted(address account, bool _isBlacklisted) external;

    function setCanBurn(address account, bool _canBurn) external;

    function setBurnBounds(uint256 _min, uint256 _max) external;

    function mint(address account, uint256 amount) external;
}
