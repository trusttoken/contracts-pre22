pragma solidity ^0.5.13;

import { Registry } from "@trusttoken/registry/contracts/Registry.sol";
import { TrueUSD } from "../TrueCurrencies/TrueUSD.sol";
import { RegistryImplementation } from "../mocks/RegistryImplementation.sol";
import { OwnedUpgradeabilityProxy } from "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import { TokenController } from "../TrueCurrencies/Admin/TokenController.sol";
import { AssuredFinancialOpportunity } from "../TrueReward/AssuredFinancialOpportunity.sol";
import { AaveFinancialOpportunity } from "../TrueReward/AaveFinancialOpportunity.sol";
import { IAToken } from "../TrueReward/IAToken.sol";
import { ILendingPool } from "../TrueReward/ILendingPool.sol";
import { TrueRewardBackedToken } from "../TrueCurrencies/TrueRewardBackedToken.sol";
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
    AssuredFinancialOpportunity assuredFinancialOpportunity; // behind proxy
    OwnedUpgradeabilityProxy assuredFinancialOpportunityProxy;
    AaveFinancialOpportunity aaveFinancialOpportunity;
    OwnedUpgradeabilityProxy aaveFinancialOpportunityProxy;
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
        address payable assuredFinancialOpportunityAddress,
        address payable assuredFinancialOpportunityProxyAddress,
        address payable aaveFinancialOpportunityAddress,
        address payable aaveFinancialOpportunityProxyAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress,
        address aTokenAddress,
        address lendingPoolAddress
    ) public onlyOwner {
        require(registryAddress != address(0), "registryAddress cannot be address(0)");
        require(trueUSDAddress != address(0), "trueUSDAddress cannot be address(0)");
        require(trueUSDProxyAddress != address(0), "trueUSDProxyAddress cannot be address(0)");
        require(assuredFinancialOpportunityProxyAddress != address(0), "assuredFinancialOpportunityProxyAddress cannot be address(0)");
        require(assuredFinancialOpportunityAddress != address(0), "assuredFinancialOpportunityAddress cannot be address(0)");
        require(aaveFinancialOpportunityAddress != address(0), "aaveFinancialOpportunityAddress cannot be address(0)");
        require(aaveFinancialOpportunityProxyAddress != address(0), "aaveFinancialOpportunityProxyAddress cannot be address(0)");
        require(exponentContractAddress != address(0), "exponentContractAddress cannot be address(0)");
        require(tokenControllerAddress != address(0), "tokenControllerAddress cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "tokenControllerProxyAddress cannot be address(0)");
        require(assurancePoolAddress != address(0), "assurancePoolAddress cannot be address(0)");
        require(liquidatorAddress != address(0), "liquidatorAddress cannot be address(0)");

        // setup TrueUSD interfaces
        setUpTrueUSD(
            registryAddress,
            trueUSDProxyAddress,
            tokenControllerProxyAddress
        ); // pass

        // setup Assurance interfaces
        setUpAssurance(
            assuredFinancialOpportunityProxyAddress,
            aaveFinancialOpportunityProxyAddress,
            exponentContractAddress,
            assurancePoolAddress,
            liquidatorAddress
        ); // pass

        // Init TrueUSD & TokenController
        initTrueUSD(trueUSDAddress, tokenControllerAddress); // pass

        // 2. Init Assurance
        initAssurance(
            assuredFinancialOpportunityAddress,
            aaveFinancialOpportunityAddress,
            aTokenAddress,
            lendingPoolAddress
        ); // pass
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
        tokenController.setFinOpAddress(address(assuredFinancialOpportunityProxy));

        // transfer ownership to owner
        tokenController.transferOwnership(address(owner));
        tokenControllerProxy.transferProxyOwnership(owner);
        trueUSDProxy.transferProxyOwnership(owner);
        registry.transferOwnership(owner);
    }

    /// @dev Initialize Assurance
    function initAssurance(
        address assuredFinancialOpportunityAddress,
        address aaveFinancialOpportunityAddress,
        address aTokenAddress,
        address lendingPoolAddress
    ) internal {
        // claim proxy
        assuredFinancialOpportunityProxy.claimProxyOwnership();
        aaveFinancialOpportunityProxy.claimProxyOwnership();

        // Use proxy as implementation
        assuredFinancialOpportunityProxy.upgradeTo(assuredFinancialOpportunityAddress);
        assuredFinancialOpportunity = AssuredFinancialOpportunity(address(assuredFinancialOpportunityProxy));
        aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityAddress);
        aaveFinancialOpportunity = AaveFinancialOpportunity(address(aaveFinancialOpportunityProxy));

        // assurancePool is set up during constructor
        liquidator.claimOwnership();
        liquidator.setPool(address(assurancePool));

        aaveFinancialOpportunity.configure(
            IAToken(aTokenAddress),
            ILendingPool(lendingPoolAddress),
            TrueRewardBackedToken(trueUSD),
            address(assuredFinancialOpportunity)
        );

        assuredFinancialOpportunity.configure(
            address(aaveFinancialOpportunity),
            address(assurancePool),
            address(liquidator),
            address(exponentContract),
            address(trueUSD),
            address(trueUSD)
        );

        // Transfer proxy to owner
        assuredFinancialOpportunityProxy.transferProxyOwnership(owner);
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
        //address payable assuredFinancialOpportunityAddress,
        address payable assuredFinancialOpportunityProxyAddress,
        address payable aaveFinancialOpportunityProxyAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) internal {
        assuredFinancialOpportunityProxy = OwnedUpgradeabilityProxy(assuredFinancialOpportunityProxyAddress);
        aaveFinancialOpportunityProxy = OwnedUpgradeabilityProxy(aaveFinancialOpportunityProxyAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
        liquidator = Liquidator(liquidatorAddress);
    }
}

