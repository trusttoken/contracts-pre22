// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../../registry/Registry.sol";

contract DepositAddressRegistrar {
    Registry public registry;

    bytes32 public constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    /// @dev Emitted when new deposit address `registeredAddress` is registered
    event DepositAddressRegistered(address registeredAddress);

    constructor(address _registry) public {
        registry = Registry(_registry);
    }

    function registerDepositAddress() public {
        address shiftedAddress = address(uint256(msg.sender) >> 20);
        require(!registry.hasAttribute(shiftedAddress, IS_DEPOSIT_ADDRESS), "deposit address already registered");
        registry.setAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS, uint256(msg.sender));
        emit DepositAddressRegistered(msg.sender);
    }

    receive() external payable {
        registerDepositAddress();
        msg.sender.transfer(msg.value);
    }
}
