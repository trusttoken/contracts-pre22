pragma solidity ^0.4.23;


import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "../TimeLockedController.sol";

contract FastPause is Claimable {
    
    TimeLockedController public controllerContract;
    event pauseKeyModified (address pauseKey, bool isValid);

    mapping(address => bool) public isPauseKey;
    
    modifier onlyPauseKey(){
        require(isPauseKey[msg.sender]);
        _;
    }
    function setController(address _newContract) public onlyOwner{
        controllerContract = TimeLockedController(_newContract);
    }
    
    function modifyPauseKey(address _pauseKey, bool _isValid ) public onlyOwner{
        isPauseKey[_pauseKey] = _isValid;
        emit pauseKeyModified(_pauseKey, _isValid);
    }
    
    function() payable onlyPauseKey {
        msg.sender.transfer(msg.value);
        controllerContract.pauseMints();
    }
}