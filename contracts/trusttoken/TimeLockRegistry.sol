// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ClaimableContract} from "./common/ClaimableContract.sol";

import {TimeLockedToken} from "./TimeLockedToken.sol";

/**
 * @title TimeLockRegistry
 * @notice Register Lockups for TimeLocked ERC20 Token
 * @author Harold Hyatt
 * @dev This contract allows owner to register distributions for a TimeLockedToken
 *
 * To register a distribution, register method should be called by the owner.
 * claim() should then be called by account registered to recieve tokens under lockup period
 * If case of a mistake, owner can cancel registration
 *
 * Note this contract must be setup in TimeLockedToken's setTimeLockRegistry() function
 */
contract TimeLockRegistry is ClaimableContract {
    // time locked token
    TimeLockedToken public token;

    // mapping from SAFT address to TRU due amount
    mapping(address => uint256) public registeredDistributions;

    event Register(address receiver, uint256 distribution);
    event Cancel(address receiver, uint256 distribution);
    event Claim(address account, uint256 distribution);

    /**
     * @dev Initalize function so this contract can be behind a proxy
     * @param _token TimeLockedToken contract to use in this registry
     */
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

        // register distribution in mapping
        registeredDistributions[receiver] = distribution;

        // transfer tokens from owner
        require(token.transferFrom(msg.sender, address(this), distribution), "Transfer failed");

        // emit register event
        emit Register(receiver, distribution);
    }

    /**
     * @dev Cancel distribution registration
     * @param receiver Address that should have it's distribution removed
     */
    function cancel(address receiver) external onlyOwner {
        require(registeredDistributions[receiver] != 0, "Not registered");

        // get amount from distributions
        uint256 amount = registeredDistributions[receiver];

        // set distribution mapping to 0
        delete registeredDistributions[receiver];

        // transfer tokens back to owner
        require(token.transfer(msg.sender, amount), "Transfer failed");

        // emit cancel event
        emit Cancel(receiver, amount);
    }

    /// @dev Claim tokens due amount
    function claim() external {
        require(registeredDistributions[msg.sender] != 0, "Not registered");

        // get amount from distributions
        uint256 amount = registeredDistributions[msg.sender];

        // set distribution mapping to 0
        delete registeredDistributions[msg.sender];

        // register lockup in TimeLockedToken
        // this will transfer funds from this contract and lock them for sender
        token.registerLockup(msg.sender, amount);

        // emit claim event
        emit Claim(msg.sender, amount);
    }
}
