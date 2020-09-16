// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TokenController, OwnedUpgradeabilityProxy} from "../../admin/TokenController.sol";

contract TokenControllerMock is TokenController {
    function initialize() external {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }
}

contract TokenControllerPauseMock is TokenControllerMock {
    address public pausedImplementation;

    function setPausedImplementation(address _pausedToken) external {
        pausedImplementation = _pausedToken;
    }

    /**
     *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
     */
    function pauseToken() external override onlyOwner {
        OwnedUpgradeabilityProxy(uint160(address(token))).upgradeTo(pausedImplementation);
    }
}
