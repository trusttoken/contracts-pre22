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
    TimeLockedToken public token;

    // mapping from SAFT address to TRU due amount
    mapping(address => uint256) public registeredDistributions;

    event Register(address receiver, uint256 distribution);
    event Cancel(address receiver, uint256 distribution);
    event Claim(address account, uint256 distribution);

    function initialize(TimeLockedToken _token) external {
        require(!initalized, "Already initialized");
        token = _token;
        owner_ = msg.sender;
        initalized = true;
    }

    /**
     * @dev Register new SAFT account
     * @param receiver Address belonging to SAFT purchaser
     * @param distribution Tokens amount that receiver is due to get
     */
    function register(address receiver, uint256 distribution) external onlyOwner {
        require(receiver != address(0), "Zero address");
        require(distribution != 0, "Distribution = 0");
        require(registeredDistributions[receiver] == 0, "Distribution for this address is already registered");
        require(token.allowance(msg.sender, address(this)) >= distribution, "Insufficient allowance");

        // register distribution in mapping
        registeredDistributions[receiver] = distribution;

        // transfer tokens from owner
        require(token.transferFrom(msg.sender, address(this), distribution), "Transfer failed");

        emit Register(receiver, distribution);
    }

    /**
     * @dev Cancel distribution registration
     * @param receiver Address that should have it's distribution removed
     */
    function cancel(address receiver) external onlyOwner {
        require(registeredDistributions[receiver] != 0, "Not registered");

        // transfer tokens back to owner
        require(token.transfer(msg.sender, registeredDistributions[receiver]), "Transfer failed");

        emit Cancel(receiver, registeredDistributions[receiver]);

        // set distribution mappig to 0
        delete registeredDistributions[receiver];
    }

    /// @dev Claim tokens due amount
    function claim() external {
        require(registeredDistributions[msg.sender] != 0, "Not registered");

        // register lockup in TimeLockedToken
        // this will transfer funds from this contract and lock them for sender
        token.registerLockup(msg.sender, registeredDistributions[msg.sender]);

        emit Claim(msg.sender, registeredDistributions[msg.sender]);

        // delete distribution mapping
        delete registeredDistributions[msg.sender];
    }
}
