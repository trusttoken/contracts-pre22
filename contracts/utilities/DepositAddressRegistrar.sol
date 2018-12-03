pragma solidity ^0.4.23;

interface Registry {
    function setAttributeValue(address who, bytes32 what, uint val) external;
}

contract DepositAddressRegistrar {
    Registry public registry;
    
    bytes32 public constant IS_DEPOSIT_ADDRESS = "isDepositAddress"; 
    event DepositAddressRegistered(address registeredAddress);

    constructor(address _registry) public {
        registry= Registry(_registry);
    }
    
    function registerDepositAddress() external {
        address shiftedAddress = address(uint(msg.sender) >> 20);
        registry.setAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS, uint(msg.sender));
        emit DepositAddressRegistered(msg.sender);
    }
    
    function() external {
        address shiftedAddress = address(uint(msg.sender) >> 20);
        registry.setAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS, uint(msg.sender));
        emit DepositAddressRegistered(msg.sender);
    }
}

