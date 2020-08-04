// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrustToken} from "../TrustToken.sol";

contract MockTrustToken is TrustToken {
    // @dev faucet for testing TrustToken
    function faucet(address receiver, uint256 amount) public {
        require(amount <= 100000000000, "can only mint 1000 TRU at once");
        _mint(receiver, amount);
    }
}
