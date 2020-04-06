pragma solidity ^0.5.13;

import "../Admin/TokenController.sol";

contract TokenControllerMock is TokenController {
    address public pausedImplementation;
    
    function setPausedImplementation(address _pausedToken) external {
        pausedImplementation = _pausedToken;
    }

    /** 
    *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
    */
    function pauseToken() external onlyFastPauseOrOwner {
        OwnedUpgradeabilityProxy(uint160(address(token))).upgradeTo(pausedImplementation);
    }

}
