// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../admin/TokenController.sol";

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
    function pauseToken() external override onlyFastPauseOrOwner {
        OwnedUpgradeabilityProxy(uint160(address(token))).upgradeTo(pausedImplementation);
    }
}
