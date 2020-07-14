// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TimeLockedToken} from "./TimeLockedToken.sol";
import {ClaimableContract} from "./ClaimableContract.sol";

/**
 * @dev This contract allows owner to register new SAFT distributions
 * To register a distribution, register method should be called by the owner.
 * claim() should then be called by SAFT account
 * If case of an error, owner can cancel registration
 */
contract TimeLockRegistry is ClaimableContract {
    // time locked token
    TimeLockedToken private token;
    // mapping from SAFT address to TRU due amount
    mapping(address => uint256) public registeredDistributions;

    constructor(TimeLockedToken _token) public {
        token = _token;
    }

    /// @dev Register new SAFT account
    function register(address receiver, uint256 distribution) external onlyOwner {
        require(receiver != address(0), "Zero address");
        require(distribution != 0, "Distribution = 0");
        require(registeredDistributions[receiver] == 0, "Distribution for this address is already registered");
        require(token.allowance(msg.sender, address(this)) >= distribution, "Insufficient allowance");

        registeredDistributions[receiver] = distribution;
        require(token.transferFrom(msg.sender, address(this), distribution), "Transfer failed");
    }

    /// @dev Cancel distribution registration
    function cancel(address receiver) external onlyOwner {
        require(registeredDistributions[receiver] != 0, "Not registered");

        require(token.transfer(msg.sender, registeredDistributions[receiver]), "Transfer failed");
        delete registeredDistributions[receiver];
    }

    /// @dev Claim TRU due amount
    function claim() external {
        require(registeredDistributions[msg.sender] != 0, "Not registered");

        token.registerLockup(msg.sender, registeredDistributions[msg.sender]);
        delete registeredDistributions[msg.sender];
    }
}
