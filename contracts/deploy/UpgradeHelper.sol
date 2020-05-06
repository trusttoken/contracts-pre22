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
    OwnedUpgradeabilityProxy financialOpportunityProxy;
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
        address payable financialOpportunityProxyAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) public onlyOwner {
        require(registryAddress != address(0), "cannot be address(0)");
        require(trueUSDProxyAddress != address(0), "cannot be address(0)");
        require(assuredOpportunityProxyAddress != address(0), "cannot be address(0)");
        require(financialOpportunityProxyAddress != address(0), "cannot be address(0)");
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
            financialOpportunityProxyAddress,
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
    function claimProxyOwnership(OwnedUpgradeabilityProxy proxy) internal {
        require(initalized, "must be initalized");
        require(proxy.pendingProxyOwner() == address(this), "not a proxy owner");
        proxy.claimProxyOwnership();
    }

    /**
     * @dev Return proxy ownership to owner
     */
    function transferProxiesToOwner(OwnedUpgradeabilityProxy proxy) internal {
        proxy.transferProxyOwnership(owner);
    }

    /**
     * @dev Upgrade TrueUSD contract
     * Must call transferOwnership on TUSD proxy
     */
    function upgradeTrueUSD(
        address newTrueUSDAddress
    ) external onlyOwner {
        // claim ownership
        claimProxyOwnership(trueUSDProxy);

        // upgrade TrueUSD and use proxy as implementation
        trueUSDProxy.upgradeTo(newTrueUSDAddress);

        // transfer ownership to owner
        transferProxiesToOwner(trueUSDProxy);
    }

    /**
     * @dev Upgrade TrueUSD contract
     * Must call transferOwnership on TUSD proxy
     */
    function upgradeFinancialOpportunity(
        address newFinancialOpportunityAddress
    ) external onlyOwner {
        // claim ownership
        claimProxyOwnership(financialOpportunityProxy);

        // upgrade TrueUSD and use proxy as implementation
        financialOpportunityProxy.upgradeTo(newFinancialOpportunityAddress);

        // transfer ownership to owner
        transferProxiesToOwner(financialOpportunityProxy);
    }

    /**
     * @dev Upgrade controller address
     */
    function upgradeController(
        address newControllerAddress)
    external onlyOwner {
        claimProxyOwnership(tokenControllerProxy);

        tokenControllerProxy.upgradeTo(newControllerAddress);

        transferProxiesToOwner(tokenControllerProxy);
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
        tokenController.claimOwnership();

        RegistryImplementation newRegistry = RegistryImplementation(newRegistryAddress);

        // initialize registry
        newRegistry.initialize();

        tokenController.setTokenRegistry(newRegistry);
        tokenController.setRegistry(newRegistry);

        // transfer Ownership to owner
        newRegistry.transferOwnership(owner);
        tokenController.transferOwnership(owner);
    }

    /**
     * @dev Upgrade AssuredFinancialOpportunity contract
     */
    function upgradeAssurance(
        address newAssuredOpportunityAddress
    ) external onlyOwner {
        claimProxyOwnership(assuredOpportunityProxy);

        assuredOpportunityProxy.upgradeTo(newAssuredOpportunityAddress);

        transferProxiesToOwner(assuredOpportunityProxy);
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
        address payable financialOpportunityProxyAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) internal {
        assuredOpportunityProxy = OwnedUpgradeabilityProxy(assuredOpportunityProxyAddress);
        assuredOpportunity = AssuredFinancialOpportunity(assuredOpportunityProxyAddress);
        financialOpportunityProxy = OwnedUpgradeabilityProxy(financialOpportunityProxyAddress);
        financialOpportunity = FinancialOpportunity(financialOpportunityProxyAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
        liquidator = Liquidator(liquidatorAddress);
    }
}

