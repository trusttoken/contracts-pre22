pragma solidity 0.5.13;

import "@trusttoken/trusttokens/contracts/Liquidator.sol";

contract LiquidatorRegistryReset is Liquidator {

    function setRegistry() external {
        registry_ = Registry(0x0000000000013949F288172bD7E36837bDdC7211);
    }
}
