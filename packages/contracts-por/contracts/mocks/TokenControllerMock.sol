// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IOwnedUpgradeabilityProxy as OwnedUpgradeabilityProxy} from "../interface/IOwnedUpgradeabilityProxy.sol";
import {IRegistry as Registry} from "../interface/IRegistry.sol";

import {ITrueCurrency as TrueCurrency} from "../interface/ITrueCurrency.sol";

import {TokenControllerV3} from "../TokenControllerV3.sol";

interface HasOwner {
    function claimOwnership() external; 
    function transferOwnership(address newOwner) external;
}

/**
 * Token Controller with custom init function for testing
 */
contract TokenControllerMock is TokenControllerV3 {
    event TransferChild(address indexed child, address indexed newOwner);

    // initalize controller. useful for tests
    function initialize() external {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }

    // initialize with paramaters. useful for tests
    // sets initial paramaters on testnet
    function initializeWithParams(TrueCurrency _token, Registry _registry) external {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
        token = _token;
        emit SetToken(_token);
        registry = _registry;
        emit SetRegistry(address(_registry));
        //gasRefunder = owner;
        //registryAdmin = owner;
        // set mint limits & thresholds
        // instant = 1M, ratified = 10M, multisig = 100M
        uint256 instant = 1000000000000000000000000;
        uint256 ratified = 10000000000000000000000000;
        uint256 multiSig = 100000000000000000000000000;
        instantMintThreshold = instant;
        ratifiedMintThreshold = ratified;
        multiSigMintThreshold = multiSig;
        instantMintLimit = instant;
        ratifiedMintLimit = ratified;
        multiSigMintLimit = multiSig;
        instantMintPool = instant;
        ratifiedMintPool = ratified;
        multiSigMintPool = multiSig;
        emit MintThresholdChanged(instant, ratified, multiSig);
        emit MintLimitsChanged(instant, ratified, multiSig);
        emit InstantPoolRefilled();
        emit RatifyPoolRefilled();
        emit MultiSigPoolRefilled();
    }

    /**
     * @dev Claim ownership of an arbitrary HasOwner contract
     */
    function issueClaimOwnership(address _other) public onlyOwner {
        HasOwner other = HasOwner(_other);
        other.claimOwnership();
    }

    /**
     * @dev Transfer ownership of _child to _newOwner.
     * Can be used e.g. to upgrade this TokenController contract.
     * @param _child contract that tokenController currently Owns
     * @param _newOwner new owner/pending owner of _child
    */
    function transferChild(HasOwner _child, address _newOwner) external onlyOwner {
        _child.transferOwnership(_newOwner);
        emit TransferChild(address(_child), _newOwner);
    }
}

contract TokenControllerPauseMock is TokenControllerMock {
    address public pausedImplementation;

    function setPausedImplementation(address _pausedToken) external {
        pausedImplementation = _pausedToken;
    }

    /**
     *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
     */
    function pauseToken() external override onlyOwner {
        OwnedUpgradeabilityProxy(uint160(address(token))).upgradeTo(pausedImplementation);
    }
}
