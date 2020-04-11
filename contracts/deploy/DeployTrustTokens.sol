pragma solidity ^0.5.13;

import { Unlock, TrustTokenVault } from "@trusttoken/trusttokens/contracts/UnlockTrustTokens.sol";

/**
 * @title DeployHelper
 * @dev Use this contract to deploy from scratch
 * Deploy contracts using a script and pass addresses into setUp
 * Deployer of DeployHelper will be final owner of proxy contracts
 *
 * Use UpgradeHelper to upgrade existing contracts
 */
contract DeployHelper {
    address payable owner;
    /**
     * @dev Setup TrueUSD
     * msg.sender needs to own all the deployed contracts
     * msg.sender needs to transfer ownership to this contract for:
     * trueUSD, trueUSDProxy, tokenController, tokenControllerProxy,
     * liquidator, assurancePool
     */
    function deploy(
        address unlockAddress
    ) external {
        owner = msg.sender;
        require(unlockAddress != address(0), "cannot be address(0)");
    }
}

