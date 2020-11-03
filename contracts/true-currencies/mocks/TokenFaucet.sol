// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TokenControllerMock} from "./TokenControllerMock.sol";

contract TokenFaucet is TokenControllerMock {
    function faucet(uint256 _amount) external {
        require(_amount <= instantMintThreshold);
        token.mint(msg.sender, _amount);
        emit InstantMint(msg.sender, _amount, msg.sender);
    }
}
