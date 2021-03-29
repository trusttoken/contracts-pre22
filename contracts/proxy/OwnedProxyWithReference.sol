// SPDX-License-Identifier: MIT
// solhint-disable const-name-snakecase
pragma solidity 0.6.10;

import {ImplementationReference} from "./ImplementationReference.sol";

/**
 * @title OwnedProxyWithReference
 * @dev This contract combines an upgradeability proxy with basic authorization control functionalities
 * Its structure makes it easy for a group of contracts alike, to share an implementation and to change it easily for all of them at once
 */
contract OwnedProxyWithReference {
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

    /**
     * @dev Event to show implementation reference has been changed
     * @param implementationReference address of the new implementation reference contract
     */
    event ImplementationReferenceChanged(address implementationReference);

    // Storage position of the owner and pendingOwner and implementationReference of the contract
    // This is made to ensure, that memory spaces do not interfere with each other
    bytes32 private constant proxyOwnerPosition = 0x6279e8199720cf3557ecd8b58d667c8edc486bd1cf3ad59ea9ebdfcae0d0dfac; //keccak256("trueUSD.proxy.owner");
    bytes32 private constant pendingProxyOwnerPosition = 0x8ddbac328deee8d986ec3a7b933a196f96986cb4ee030d86cc56431c728b83f4; //keccak256("trueUSD.pending.proxy.owner");
    bytes32 private constant implementationReferencePosition = keccak256("trueFiPool.implementation.reference"); //keccak256("trueFiPool.implementation.reference");

    /**
     * @dev the constructor sets the original owner of the contract to the sender account.
     * @param _owner Initial owner of the proxy
     * @param _implementationReference initial ImplementationReference address
     */
    constructor(address _owner, address _implementationReference) public {
        _setUpgradeabilityOwner(_owner);
        _changeImplementationReference(_implementationReference);
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
     * @dev Tells the address of the owner
     * @return pendingOwner the address of the pending owner
     */
    function pendingProxyOwner() public view returns (address pendingOwner) {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            pendingOwner := sload(position)
        }
    }

    /**
     * @dev Sets the address of the owner
     * @param newProxyOwner New owner to be set
     */
    function _setUpgradeabilityOwner(address newProxyOwner) internal {
        bytes32 position = proxyOwnerPosition;
        assembly {
            sstore(position, newProxyOwner)
        }
    }

    /**
     * @dev Sets the address of the owner
     * @param newPendingProxyOwner New pending owner address
     */
    function _setPendingUpgradeabilityOwner(address newPendingProxyOwner) internal {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            sstore(position, newPendingProxyOwner)
        }
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * changes the pending owner to newOwner. But doesn't actually transfer
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
     * @dev Allows the proxy owner to change the contract holding address of implementation.
     * @param _implementationReference representing the address contract, which holds implementation.
     */
    function changeImplementationReference(address _implementationReference) public virtual onlyProxyOwner {
        _changeImplementationReference(_implementationReference);
    }

    /**
     * @dev Get the address of current implementation.
     * @return Returns address of implementation contract
     */
    function implementation() public view returns (address) {
        bytes32 position = implementationReferencePosition;
        address implementationReference;
        assembly {
            implementationReference := sload(position)
        }
        return ImplementationReference(implementationReference).implementation();
    }

    /**
     * @dev Fallback functions allowing to perform a delegatecall to the given implementation.
     * This function will return whatever the implementation call returns
     */
    fallback() external payable {
        proxyCall();
    }

    /**
     * @dev This fallback function gets called only when this contract is called without any calldata e.g. send(), transfer()
     * This would also trigger receive() function on called implementation
     */
    receive() external payable {
        proxyCall();
    }

    /**
     * @dev Performs a low level call, to the contract holding all the logic, changing state on this contract at the same time
     */
    function proxyCall() internal {
        address impl = implementation();

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), impl, ptr, calldatasize(), 0, 0)
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

    /**
     * @dev Function to internally change the contract holding address of implementation.
     * @param _implementationReference representing the address contract, which holds implementation.
     */
    function _changeImplementationReference(address _implementationReference) internal virtual {
        bytes32 position = implementationReferencePosition;
        assembly {
            sstore(position, _implementationReference)
        }

        emit ImplementationReferenceChanged(address(_implementationReference));
    }
}
