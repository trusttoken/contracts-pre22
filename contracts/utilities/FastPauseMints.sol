pragma solidity ^0.4.21;


import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "../Admin/TokenController.sol";

/*
Allows for admins to quickly respond to fradulent mints
After deploying FastPauseMints and configuring it with TokenController
Can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdPauser address
*/
contract FastPauseMints is Claimable {
    
    TokenController public controllerContract;
    address public trueUsdMintPauser;

    event FastTrueUSDMintsPause(address who);
    
    modifier onlyPauseKey() {
        require(msg.sender == trueUsdMintPauser, "not pause key");
        _;
    }

    constructor(address _trueUsdMintPauser, address _controllerContract) public {
        controllerContract = TokenController(_controllerContract);
        trueUsdMintPauser = _trueUsdMintPauser;
    }

    //fallback function used to pause mints when it recieves eth
    function() public payable onlyPauseKey {
        emit FastTrueUSDMintsPause(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseMints();
    }
}