pragma solidity ^0.4.24;

import "../Admin/TokenController.sol";

/*
Allows for admins to quickly respond to critical emergencies
After deploying FastPauseTrueUSD and configuring it with TokenController, admins
can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdPauser address
*/
contract FastPauseTrueUSD {
    
    TokenController public controllerContract;
    address public trueUsdPauser;
    
    event FastTrueUSDPause(address sender);

    constructor(address _trueUsdPauser, address _controllerContract) public {
        controllerContract = TokenController(_controllerContract);
        trueUsdPauser = _trueUsdPauser;
    }
    
    modifier onlyPauseKey() {
        require(msg.sender == trueUsdPauser, "not TrueUSD pauser");
        _;
    }

    //fallback function used to pause trueUSD when it recieves eth
    function() public payable onlyPauseKey {
        emit FastTrueUSDPause(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseTrueUSD();
    }
}