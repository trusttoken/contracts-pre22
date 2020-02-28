pragma solidity ^0.5.13;

import "../TrueCAD.sol";

contract TrueCADMock is TrueCAD {
    function initialize() public {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        burnMin = 10000 * 10**uint256(DECIMALS);
        burnMax = 20000000 * 10**uint256(DECIMALS);
    }
}
