// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../tokens/TrueUSD.sol";

contract MockTrueUSD is TrueUSD {
    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }
}
