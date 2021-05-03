// SPDX-License-Identifier: MIT
// solhint-disable const-name-snakecase
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title OwnedUpgradeabilityProxy
 * @dev This contract combines an upgradeability proxy with basic authorization control functionalities
 * Additionally implementation can be changed only with a set time delay
 */
contract TimeLockedOwnedUpgradeabilityProxy {
    using SafeMath for uint256;

    /**
     * @dev Event to show ownership has been transferred
     * @param previousOwner representing the address of the previous owner
     * @param newOwner representing the address of the new owner
     */
    event ProxyOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Event to show ownership transfer is pending
     * @param currentOwner representing the address of the current owner
     * @param pendingOwner representing the address of the pending owner
     */
    event NewPendingOwner(address currentOwner, address pendingOwner);

    // Storage position of the owner and pendingOwner of the contract
    bytes32 private constant proxyOwnerPosition = 0x6279e8199720cf3557ecd8b58d667c8edc486bd1cf3ad59ea9ebdfcae0d0dfac; //keccak256("trueUSD.proxy.owner");
    bytes32 private constant pendingProxyOwnerPosition = 0x8ddbac328deee8d986ec3a7b933a196f96986cb4ee030d86cc56431c728b83f4; //keccak256("trueUSD.pending.proxy.owner");

    // Storage position of the pendingImplementation and implementationUnlockTimestamp
    bytes32 private constant pendingImplementationPosition = 0x4359d49cbfd2cc607978416ae1dea85f5262cf4529e27457e37b57e7442a4d7c; //keccak256("truefi.pending.implementation");
    bytes32
        private constant implementationUnlockTimestampPosition = 0xcf61f7598d90ff2ffb1943849fdb26d9724ff84436f33ef54158376ce6a5f983; //keccak256("truefi.implementation.unlock.timestamp");

    // Storage position of delay, pendingDelay and delayUnlockTimestamp
    bytes32 private constant delayPosition = 0xebc3dcd17da29814a80851128f1891f608c2818c3e9458610aa4bb3eb5d12727; //keccak256("truefi.delay");
    bytes32 private constant pendingDelayPosition = 0x83f53add1661b003726c66a030c7e89742291b05ffc1d42d8b9df532d2c3c4a4; //keccak256("truefi.pending.delay");
    bytes32 private constant delayUnlockTimestampPosition = 0x372f30a889207caf68f3492d7e16ececd7dcab7d32776b318351083da409103b; //keccak256("truefi.delay.timestamp");

    /**
     * @dev the constructor sets the original owner of the contract to the sender account.
     */
    constructor() public {
        _setUpgradeabilityOwner(msg.sender);
        _setDelay(10 days);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only Proxy Owner");
        _;
    }

    /**
     * @dev Throws if called by any account other than the pending owner.
     */
    modifier onlyPendingProxyOwner() {
        require(msg.sender == pendingProxyOwner(), "only pending Proxy Owner");
        _;
    }

    /**
     * @dev Tells the address of the owner
     * @return owner the address of the owner
     */
    function proxyOwner() public view returns (address owner) {
        bytes32 position = proxyOwnerPosition;
        assembly {
            owner := sload(position)
        }
    }

    /**
     * @dev Tells the address of the pending owner
     * @return pendingOwner the address of the pending owner
     */
    function pendingProxyOwner() public view returns (address pendingOwner) {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            pendingOwner := sload(position)
        }
    }

    /**
     * @dev Tells the address of the pending implementation
     * @return _pendingImplementation the address of the pending implementation
     */
    function pendingImplementation() public view returns (address _pendingImplementation) {
        bytes32 position = pendingImplementationPosition;
        assembly {
            _pendingImplementation := sload(position)
        }
    }

    /**
     * @dev Tells the timestamp on which proxy could be upgraded to pending implementation
     * @return _implementationUnlockTimestamp timestamp on which proxy could be upgraded to pending implementation
     */
    function implementationUnlockTimestamp() public view returns (uint256 _implementationUnlockTimestamp) {
        bytes32 position = implementationUnlockTimestampPosition;
        assembly {
            _implementationUnlockTimestamp := sload(position)
        }
    }

    /**
     * @dev Tells the delay for time locked functions
     * @return _delay delay for time locked functions
     */
    function delay() public view returns (uint256 _delay) {
        bytes32 position = delayPosition;
        assembly {
            _delay := sload(position)
        }
    }

    /**
     * @dev Tells the pendingDelay for time locked functions
     * @return _pendingDelay pendingDelay for time locked functions
     */
    function pendingDelay() public view returns (uint256 _pendingDelay) {
        bytes32 position = pendingDelayPosition;
        assembly {
            _pendingDelay := sload(position)
        }
    }

    /**
     * @dev Tells the timestamp on which time lock pending delay could be set
     * @return _delayUnlockTimestamp timestamp on which time lock pending delay could be set
     */
    function delayUnlockTimestamp() public view returns (uint256 _delayUnlockTimestamp) {
        bytes32 position = delayUnlockTimestampPosition;
        assembly {
            _delayUnlockTimestamp := sload(position)
        }
    }

    /**
     * @dev Sets the address of the owner
     */
    function _setUpgradeabilityOwner(address newProxyOwner) internal {
        bytes32 position = proxyOwnerPosition;
        assembly {
            sstore(position, newProxyOwner)
        }
    }

    /**
     * @dev Sets the address of the owner
     */
    function _setPendingUpgradeabilityOwner(address newPendingProxyOwner) internal {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            sstore(position, newPendingProxyOwner)
        }
    }

    /**
     * @dev Sets delay
     */
    function _setDelay(uint256 _delay) internal {
        bytes32 position = delayPosition;
        uint256 currentDelay;
        assembly {
            currentDelay := sload(delayPosition)
        }
        require(currentDelay != _delay);
        assembly {
            sstore(position, _delay)
        }
        emit DelayChanged(_delay);
    }

    /**
     * @dev This event will be emitted every time the delay is changed
     * @param _delay new delay
     */
    event DelayChanged(uint256 _delay);

    /**
     * @dev Allows the proxy owner to upgrade the current version of the proxy.
     * @param _implementation representing the address of the new implementation to be set.
     */
    function _upgradeTo(address _implementation) internal {
        address currentImplementation;
        bytes32 position = implementationPosition;
        assembly {
            currentImplementation := sload(position)
        }
        require(currentImplementation != _implementation);
        assembly {
            sstore(position, _implementation)
        }
        emit Upgraded(_implementation);
    }

    /**
     * @dev This event will be emitted every time the implementation gets upgraded
     * @param implementation representing the address of the upgraded implementation
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     *changes the pending owner to newOwner. But doesn't actually transfer
     * @param newOwner The address to transfer ownership to.
     */
    function transferProxyOwnership(address newOwner) external onlyProxyOwner {
        require(newOwner != address(0));
        _setPendingUpgradeabilityOwner(newOwner);
        emit NewPendingOwner(proxyOwner(), newOwner);
    }

    /**
     * @dev Allows the pendingOwner to claim ownership of the proxy
     */
    function claimProxyOwnership() external onlyPendingProxyOwner {
        emit ProxyOwnershipTransferred(proxyOwner(), pendingProxyOwner());
        _setUpgradeabilityOwner(pendingProxyOwner());
        _setPendingUpgradeabilityOwner(address(0));
    }

    /**
     * @dev Initializes cooldown on setting new delay variable
     */
    function initializeSetDelay(uint256 _delay) external onlyProxyOwner {
        uint256 unlockTime = block.timestamp.add(delay());
        assembly {
            sstore(delayUnlockTimestampPosition, unlockTime)
            sstore(pendingDelayPosition, _delay)
        }
    }

    /**
     * @dev Execute set delay with previously initialize value
     */
    function executeSetDelay() external {
        require(block.timestamp >= delayUnlockTimestamp(), "not enough time has passed");
        uint256 _delay;
        assembly {
            _delay := sload(pendingDelayPosition)
        }
        _setDelay(_delay);
    }

    /**
     * @dev Initializes cooldown on upgrading to new implementation
     */
    function initializeUpgradeTo(uint256 _implementation) external onlyProxyOwner {
        uint256 unlockTime = block.timestamp.add(delay());
        assembly {
            sstore(implementationUnlockTimestampPosition, unlockTime)
            sstore(pendingImplementationPosition, _implementation)
        }
    }

    /**
     * @dev Execute upgrading to new implementation after delay
     */
    function executeUpgradeTo() external {
        require(block.timestamp >= implementationUnlockTimestamp(), "not enough time has passed");
        address _implementation;
        assembly {
            _implementation := sload(pendingImplementationPosition)
        }
        _upgradeTo(_implementation);
    }

    // Storage position of the address of the current implementation
    bytes32 private constant implementationPosition = 0x6e41e0fbe643dfdb6043698bf865aada82dc46b953f754a3468eaa272a362dc7; //keccak256("trueUSD.proxy.implementation");

    function implementation() public view returns (address impl) {
        bytes32 position = implementationPosition;
        assembly {
            impl := sload(position)
        }
    }

    /**
     * @dev Fallback functions allowing to perform a delegatecall to the given implementation.
     * This function will return whatever the implementation call returns
     */
    fallback() external payable {
        proxyCall();
    }

    receive() external payable {
        proxyCall();
    }

    function proxyCall() internal {
        bytes32 position = implementationPosition;

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, returndatasize(), calldatasize())
            let result := delegatecall(gas(), sload(position), ptr, calldatasize(), returndatasize(), returndatasize())
            returndatacopy(ptr, 0, returndatasize())

            switch result
                case 0 {
                    revert(ptr, returndatasize())
                }
                default {
                    return(ptr, returndatasize())
                }
        }
    }
}
