// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IBEP20} from "./IBEP20.sol";
import {IClaimableOwnable} from "./IClaimableOwnable.sol";

interface ITrueCurrency is IClaimableOwnable {
    function mint(address account, uint256 amount) external;

    function burn(uint256 amount) external;

    function setCanBurn(address account, bool _canBurn) external;

    function setBurnBounds(uint256 _min, uint256 _max) external;

    function reclaimEther(address payable _to) external;

    function reclaimToken(IBEP20 token, address _to) external;

    function setBlacklisted(address account, bool isBlacklisted) external;
}
