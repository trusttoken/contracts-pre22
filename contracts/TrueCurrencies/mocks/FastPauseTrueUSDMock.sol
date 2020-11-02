pragma solidity 0.5.13;

import "./TokenControllerMock.sol";

/*
Allows for admins to quickly respond to critical emergencies
After deploying FastPauseTrueUSD and configuring it with TokenController, admins
can pause trueUSD by simply sending any amount of ether to this contract
from the trueUsdPauser address
*/
contract FastPauseTrueUSDMock {
    TokenController public controllerContract;
    address public trueUsdPauser;

    event FastTrueUSDPause(address indexed sender);

    constructor(address _trueUsdPauser, address _controllerContract) public {
        require(
            _trueUsdPauser != address(0) && _controllerContract != address(0)
        );
        controllerContract = TokenController(_controllerContract);
        trueUsdPauser = _trueUsdPauser;
    }

    modifier onlyPauseKey() {
        require(msg.sender == trueUsdPauser, "not TrueUSD pauser");
        _;
    }

    //fallback function used to pause trueUSD when it receives eth
    function() external payable onlyPauseKey {
        emit FastTrueUSDPause(msg.sender);
        msg.sender.transfer(msg.value);
        controllerContract.pauseToken();
    }
}
