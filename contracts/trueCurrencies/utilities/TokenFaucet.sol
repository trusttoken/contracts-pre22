// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../mocks/TokenControllerMock.sol";

contract TokenFaucet is TokenControllerMock {
    function faucet(uint256 _amount) external {
        // set KYC
        registry.setAttributeValue(msg.sender, 0x6861735061737365644b59432f414d4c00000000000000000000000000000000, 1);
        // whitelist trueRewards
        registry.setAttributeValue(msg.sender, 0x6973547275655265776172647357686974656c69737465640000000000000000, 1);
        require(_amount <= instantMintThreshold);
        token.mint(msg.sender, _amount);
        emit InstantMint(msg.sender, _amount, msg.sender);
    }

    function whitelistTrueRewards() external {
        registry.setAttributeValue(msg.sender, 0x6973547275655265776172647357686974656c69737465640000000000000000, 1);
    }
}
