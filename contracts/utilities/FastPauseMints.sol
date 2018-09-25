pragma solidity ^0.4.21;


import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "../TimeLockedController.sol";

/*
Allows for admins to quickly respond to fradulent mints
After deploying FastPauseMints and configuring it with TimeLockedController
Can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdPauser address
*/
contract FastPauseMints is Claimable {
    
    TimeLockedController public controllerContract;

    event PauseKeyModified (address pauseKey, bool isValid);
    event Pauser(address who);

    mapping(address => bool) public isPauseKey;
    
    modifier onlyPauseKey() {
        require(isPauseKey[msg.sender], "not pause key");
        _;
    }
    function setController(address _newContract) public onlyOwner {
        controllerContract = TimeLockedController(_newContract);
    }
    
    //modify which addresses can pause mints by sending in eth
    function modifyPauseKey(address _pauseKey, bool _isValid ) public onlyOwner {
        isPauseKey[_pauseKey] = _isValid;
        emit PauseKeyModified(_pauseKey, _isValid);
    }

    //fallback function used to pause mints when it recieves eth
    function() public payable onlyPauseKey {
        emit Pauser(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseMints();
    }
}