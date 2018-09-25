pragma solidity ^0.4.21;

import "../TimeLockedController.sol";

/*
Allows for admins to quickly respond to critical emergencies
After deploying FastPauseTrueUSD and configuring it with TimeLockedController
Can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdPauser address
*/
contract FastPauseTrueUSD {
    
    TimeLockedController public controllerContract;
    address public trueUsdPauser;
    
    event FastTrueUSDPause(address sender);

    constructor (address _trueUsdPauser, address _controllerContract) public {
        controllerContract = TimeLockedController(_controllerContract);
        trueUsdPauser = _trueUsdPauser;
    }
    
    modifier onlyPauser() {
        require(msg.sender == trueUsdPauser, "not TrueUSD pauser");
        _;
    }

    //fallback function used to pause trueUSD when it recieves eth
    function() public payable onlyPauser {
        emit FastTrueUSDPause(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseTrueUSD();
    }
}