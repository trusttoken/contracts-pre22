pragma solidity ^0.5.13;

import "../Admin/TokenController.sol";

/*
Allows for admins to quickly respond to fraudulent mints
After deploying FastPauseMints and configuring it with TokenController, admins can
can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdMintPauser address.
*/
contract FastPauseMints {
    
    TokenController public controllerContract;
    address public trueUsdMintPauser;

    event FastTrueUSDMintsPause(address indexed who);
    
    modifier onlyPauseKey() {
        require(msg.sender == trueUsdMintPauser, "not pause key");
        _;
    }

    constructor(address _trueUsdMintPauser, address _controllerContract) public {
        require(_trueUsdMintPauser != address(0) && _controllerContract != address(0));
        controllerContract = TokenController(_controllerContract);
        trueUsdMintPauser = _trueUsdMintPauser;
    }

    //fallback function used to pause mints when it recieves eth
    function() external payable onlyPauseKey {
        emit FastTrueUSDMintsPause(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseMints();
    }
}
