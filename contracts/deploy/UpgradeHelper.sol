pragma solidity ^0.5.13;

import { Registry } from "@trusttoken/registry/contracts/Registry.sol";
import { TrueUSD } from "../TrueCurrencies/TrueUSD.sol";
import { RegistryImplementation } from "../mocks/RegistryImplementation.sol";
import { OwnedUpgradeabilityProxy } from "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import { TokenController } from "../TrueCurrencies/Admin/TokenController.sol";
import { AssuredFinancialOpportunity } from "../TrueReward/AssuredFinancialOpportunity.sol";
import { FinancialOpportunity } from "../TrueReward/FinancialOpportunity.sol";
import { IExponentContract } from "../TrueReward/utilities/IExponentContract.sol";
import { StakedToken } from "@trusttoken/trusttokens/contracts/StakedToken.sol";
import { Liquidator } from "@trusttoken/trusttokens/contracts/Liquidator.sol";

/**
 * @title UpgradeHelper
 * @dev Use this contract to upgrade parts of the TUSD contracts
 * Deploy new contracts using a script and pass addresses into setUp
 * Deployer of UpgradeHelper will be final owner of proxy contracts
 * Must transfer ownership of proxies for token, controller, and assurnace
 *
 * Use DeployHelper to deploy contracts from scratch
 * see also: upgrade.js
 */
contract UpgradeHelper {
    bool initalized = false;
    address payable public owner;
    RegistryImplementation registry;
    TrueUSD trueUSD; // behind proxy
    OwnedUpgradeabilityProxy trueUSDProxy;
    TokenController tokenController; // behind proxy
    OwnedUpgradeabilityProxy tokenControllerProxy;
    AssuredFinancialOpportunity assuredOpportunity; // behind proxy
    OwnedUpgradeabilityProxy assuredOpportunityProxy;
    FinancialOpportunity financialOpportunity;
    IExponentContract exponentContract;
    StakedToken assurancePool;
    Liquidator liquidator;

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Setup TrueUSD
     * msg.sender needs to own all the deployed contracts
     * msg.sender needs to transfer ownership to this contract for upgrades
     */
    function setup(
        address registryAddress,
        address payable trueUSDProxyAddress,
        address payable tokenControllerProxyAddress,
        address payable assuredOpportunityProxyAddress,
        address financialOpportunityAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) public onlyOwner {
        require(registryAddress != address(0), "cannot be address(0)");
        require(trueUSDProxyAddress != address(0), "cannot be address(0)");
        require(assuredOpportunityProxyAddress != address(0), "cannot be address(0)");
        require(financialOpportunityAddress != address(0), "cannot be address(0)");
        require(exponentContractAddress != address(0), "cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "cannot be address(0)");
        require(assurancePoolAddress != address(0), "cannot be address(0)");
        require(liquidatorAddress != address(0), "cannot be address(0)");

        setUpTrueUSD(
            registryAddress,
            trueUSDProxyAddress,
            tokenControllerProxyAddress
        );

        setUpAssurance(
            assuredOpportunityProxyAddress,
            financialOpportunityAddress,
            exponentContractAddress,
            assurancePoolAddress,
            liquidatorAddress
        );

        initalized = true;
    }

    /**
     * @dev Claim ownership of proxies
     * Proxy ownership be transferred to this contract
     */
    function claimProxyOwnership() internal {
        require(initalized, "must be initalized");
        require(trueUSDProxy.pendingProxyOwner() == address(this), "not token proxy owner");
        require(tokenControllerProxy.pendingProxyOwner() == address(this), "not controller proxy owner");
        require(assuredOpportunityProxy.pendingProxyOwner() == address(this), "not assurance proxy owner");
        tokenControllerProxy.claimProxyOwnership();
        trueUSDProxy.claimProxyOwnership();
        assuredOpportunityProxy.claimProxyOwnership();
    }

    /**
     * @dev Return proxy ownership to owner
     */
    function transferProxiesToOwner() internal {
        tokenControllerProxy.transferProxyOwnership(owner);
        trueUSDProxy.transferProxyOwnership(owner);
        assuredOpportunityProxy.transferProxyOwnership(owner);
        require(trueUSDProxy.pendingProxyOwner() == owner, "must transfer token proxy to owner");
        require(tokenControllerProxy.pendingProxyOwner() == owner, "must transfer controller proxy to owner");
        require(assuredOpportunityProxy.pendingProxyOwner() == owner, "must transfer assurance proxy to owner");
    }

    /**
     * @dev Upgrade TrueUSD contract
     * Must call transferOwnership on TUSD proxy
     */
    function upgradeTrueUSD(
        address newTrueUSDAddress
    ) external onlyOwner {
        // claim ownership
        claimProxyOwnership();

        // upgrade TrueUSD and use proxy as implementation
        trueUSDProxy.upgradeTo(newTrueUSDAddress);

        // transfer ownership to owner
        transferProxiesToOwner();
    }

    /**
     * @dev Upgrade controller address
     */
    function upgradeController(
        address newControllerAddress)
    external onlyOwner {
        claimProxyOwnership();

        // upgrade proxy to new token controller
        tokenControllerProxy.upgradeTo(newControllerAddress);
        tokenController = TokenController(address(tokenControllerProxy));

        trueUSD.setOpportunityAddress(address(assuredOpportunityProxy));

        // transfer ownership to owner
        tokenController.transferOwnership(address(owner));
        registry.transferOwnership(owner);
        transferProxiesToOwner();
    }

    /**
     * @dev Upgrade Registry contract
     * We keep the old registry contract owned by owner in case we want to
     * revert to old registry
     * Here we can also update attributes from the old registry
     */
    function upgradeRegistry(
        address newRegistryAddress)
    external onlyOwner {
        claimProxyOwnership();
        RegistryImplementation newRegistry = RegistryImplementation(newRegistryAddress);
        registry.claimOwnership();
        newRegistry.claimOwnership();

        // initalize registry
        newRegistry.initialize();

        tokenController.setTokenRegistry(newRegistry);
        tokenController.setRegistry(newRegistry);

        // transfer Ownership to owner
        registry.transferOwnership(owner);
        newRegistry.transferOwnership(owner);
        transferProxiesToOwner();
    }

    /**
     * @dev Upgrade AssuredFinancialOpportunity contract
     */
    function upgradeAssurance(
        address payable newAssuredOpportunityAddress
    ) external onlyOwner {
        claimProxyOwnership();

        assuredOpportunityProxy.upgradeTo(newAssuredOpportunityAddress);

        transferProxiesToOwner();
    }

    /**
     * @dev Set up contract interfaces
     * Called via setup function
     */
    function setUpTrueUSD(
        address registryAddress,
        address payable trueUSDProxyAddress,
        address payable tokenControllerProxyAddress
    ) internal {
        registry = RegistryImplementation(registryAddress);
        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        trueUSD = TrueUSD(trueUSDProxyAddress);
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
        tokenController = TokenController(tokenControllerProxyAddress);
    }

    /**
     * @dev Set up contract interfaces
     * called via setup function
     */
    function setUpAssurance(
        address payable assuredOpportunityProxyAddress,
        address financialOpportunityAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) internal {
            assuredOpportunityProxy = OwnedUpgradeabilityProxy(assuredOpportunityProxyAddress);
            assuredOpportunity = AssuredFinancialOpportunity(assuredOpportunityProxyAddress);
        financialOpportunity = FinancialOpportunity(financialOpportunityAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
        liquidator = Liquidator(liquidatorAddress);
    }
}

