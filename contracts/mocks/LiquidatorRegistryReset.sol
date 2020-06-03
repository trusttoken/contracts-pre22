pragma solidity 0.5.13;

import "@trusttoken/trusttokens/contracts/Liquidator.sol";

contract LiquidatorRegistryReset is Liquidator {

    function setRegistry(address registryAddress) external onlyOwner {
        require(registryAddress != address(0), "registry cannot be address(0)");
        registry_ = Registry(registryAddress);
    }
}
