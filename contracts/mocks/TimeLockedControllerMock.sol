pragma solidity ^0.4.18;

import "../TimeLockedController.sol";
import "./TrueUSDMock.sol";

contract TimeLockedControllerMock is TimeLockedController {
    function TimeLockedControllerMock(address initialAccount, uint256 initialBalance) public {
        trueUSD = new TrueUSDMock(initialAccount, initialBalance);
        trueUSD.setRegistry(new Registry());
    }
}
