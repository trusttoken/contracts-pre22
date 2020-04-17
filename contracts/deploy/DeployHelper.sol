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
 * @title DeployHelper
 * @dev Use this contract to deploy from scratch
 * Deploy contracts using a script and pass addresses into setUp
 * Deployer of DeployHelper will be final owner of proxy contracts
 *
 * Use UpgradeHelper to upgrade existing contracts
 */
contract DeployHelper {
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
     * msg.sender needs to transfer ownership to this contract for:
     * trueUSD, trueUSDProxy, tokenController, tokenControllerProxy,
     * liquidator, assurancePool
     */
    function setup(
        address registryAddress,
        address trueUSDAddress,
        address payable trueUSDProxyAddress,
        address payable tokenControllerAddress,
        address payable tokenControllerProxyAddress,
        address payable assuredOpportunityAddress,
        address payable assuredOpportunityProxyAddress,
        address financialOpportunityAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) public onlyOwner {
        require(registryAddress != address(0), "cannot be address(0)");
        require(trueUSDAddress != address(0), "cannot be address(0)");
        require(trueUSDProxyAddress != address(0), "cannot be address(0)");
        require(assuredOpportunityProxyAddress != address(0), "cannot be address(0)");
        require(assuredOpportunityAddress != address(0), "cannot be address(0)");
        require(financialOpportunityAddress != address(0), "cannot be address(0)");
        require(exponentContractAddress != address(0), "cannot be address(0)");
        require(tokenControllerAddress != address(0), "cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "cannot be address(0)");
        require(assurancePoolAddress != address(0), "cannot be address(0)");
        require(liquidatorAddress != address(0), "cannot be address(0)");

        // setup TrueUSD interfaces
        setUpTrueUSD(
            registryAddress,
            trueUSDProxyAddress,
            tokenControllerProxyAddress
        ); // pass

        // setup Assurance interfaces
        setUpAssurance(
            assuredOpportunityProxyAddress,
            financialOpportunityAddress,
            exponentContractAddress,
            assurancePoolAddress,
            liquidatorAddress
        ); // pass

        // Init TrueUSD & TokenController
        initTrueUSD(trueUSDAddress, tokenControllerAddress); // pass

        // 2. Init Assurance
        initAssurance(assuredOpportunityAddress); // pass
    }

    // @dev Init TrueUSD & TokenController
    function initTrueUSD(
        address trueUSDAddress,
        address tokenControllerAddress
    ) internal {
        require(trueUSDProxy.pendingProxyOwner() == address(this), "not token proxy owner");
        require(tokenControllerProxy.pendingProxyOwner() == address(this), "not controller proxy owner");

        // claim ownership of proxies
        tokenControllerProxy.claimProxyOwnership();
        trueUSDProxy.claimProxyOwnership(); //pass
        registry.claimOwnership();

        // setup registry here

        // use proxies as implementations
        trueUSDProxy.upgradeTo(trueUSDAddress);
        trueUSD = TrueUSD(address(trueUSDProxy));
        tokenControllerProxy.upgradeTo(tokenControllerAddress);
        tokenController = TokenController(address(tokenControllerProxy));

        // initialize contracts for ownership
        registry.initialize();
        tokenController.initialize();
        trueUSD.initialize();

        // transfer trueUSD ownership to controller
        trueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(trueUSD));

        // set token and registry for controller
        tokenController.setToken(trueUSD);
        tokenController.setTokenRegistry(registry);
        tokenController.setRegistry(registry);
        tokenController.setAaveInterfaceAddress(address(assuredOpportunityProxy));

        // transfer ownership to owner
        tokenController.transferOwnership(address(owner));
        tokenControllerProxy.transferProxyOwnership(owner);
        trueUSDProxy.transferProxyOwnership(owner);
        registry.transferOwnership(owner);
    }

    /// @dev Initialize Assurance
    function initAssurance(address assuredOpportunityAddress) internal {
        // claim proxy
        assuredOpportunityProxy.claimProxyOwnership();

        // Use proxy as implementation
        assuredOpportunityProxy.upgradeTo(assuredOpportunityAddress);
        assuredOpportunity = AssuredFinancialOpportunity(address(assuredOpportunityProxy));

        // assurancePool is set up during constructor
        liquidator.claimOwnership();
        liquidator.setPool(address(assurancePool));

        assuredOpportunity.configure(
            address(financialOpportunity),
            address(assurancePool),
            address(liquidator),
            address(exponentContract),
            address(trueUSD),
            address(trueUSD)
        );

        // Transfer proxy to owner
        assuredOpportunityProxy.transferProxyOwnership(owner);
        liquidator.transferOwnership(owner);
    }

    /**
     * @dev Set up contract interfaces
     */
    function setUpTrueUSD(
        address registryAddress,
        address payable trueUSDProxyAddress,
        address payable tokenControllerProxyAddress
    ) internal {
        registry = RegistryImplementation(registryAddress);
        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
    }

    /**
     * @dev Set up contract interfaces
     */
    function setUpAssurance(
        //address payable assuredOpportunityAddress,
        address payable assuredOpportunityProxyAddress,
        address financialOpportunityAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) internal {
        assuredOpportunityProxy = OwnedUpgradeabilityProxy(assuredOpportunityProxyAddress);
        financialOpportunity = FinancialOpportunity(financialOpportunityAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
        liquidator = Liquidator(liquidatorAddress);
    }
}

