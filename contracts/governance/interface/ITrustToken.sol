// SPDX-License-Identifier: MIT 

pragma solidity ^0.6.10;

interface TrustTokenInterface {
    function getPriorVotes(address account, uint blockNumber) external view returns (uint96);
}