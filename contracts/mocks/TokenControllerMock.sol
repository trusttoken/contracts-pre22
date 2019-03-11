pragma solidity ^0.4.23;

import "../Admin/TokenController.sol";

contract TokenControllerMock is TokenController {
    address public pausedImplementation;
    
    function setPausedImplementation(address _pausedTrueUSD) external {
        pausedImplementation = _pausedTrueUSD;
    }

    /** 
    *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
    */
    function pauseTrueUSD() external onlyFastPauseOrOwner {
        OwnedUpgradeabilityProxy(trueUSD).upgradeTo(pausedImplementation);
    }

}