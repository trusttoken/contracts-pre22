pragma solidity ^0.5.13;

import { Registry } from "@trusttoken/registry/contracts/Registry.sol";
import { TrueUSD } from "../TrueCurrencies/TrueUSD.sol";
import { OwnedUpgradeabilityProxy } from "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import { TokenController } from "../TrueCurrencies/admin/TokenController.sol";
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
    address payable owner;
    Registry registry;
    TrueUSD trueUSD;
    OwnedUpgradeabilityProxy trueUSDProxy;
    TokenController tokenController;
    OwnedUpgradeabilityProxy tokenControllerProxy;
    AssuredFinancialOpportunity assuredOpportunity;
    OwnedUpgradeabilityProxy assuredOpportunityProxy;
    FinancialOpportunity financialOpportunity;
    IExponentContract exponentContract;
    StakedToken assurancePool;
    Liquidator liquidator;

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
    ) public {
        owner = msg.sender;
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

        // setup TrueUSD implementations
        setUpTrueUSD(
            registryAddress, 
            trueUSDAddress,
            trueUSDProxyAddress,
            tokenControllerAddress,
            tokenControllerProxyAddress
        );

        setUpAssurance(
            assuredOpportunityAddress,
            assuredOpportunityProxyAddress,
            financialOpportunityAddress,
            exponentContractAddress,
            assurancePoolAddress,
            liquidatorAddress
        );

        // Init TrueUSD & TokenController
        initTrueUSD();

        // 2. Init Assurance
        initAssurance();
    }

    // @dev Init TrueUSD & TokenController
    function initTrueUSD() internal {
        require(trueUSDProxy.pendingProxyOwner() == address(this), "not pending proxy owner");

        // claim ownership of contracts
        tokenController.claimOwnership();
        tokenControllerProxy.claimProxyOwnership();
        trueUSD.claimOwnership();
        trueUSDProxy.claimProxyOwnership();

        // setup trueUSD
        trueUSD.setAaveInterfaceAddress(address(assuredOpportunityProxy));
        trueUSD.setRegistry(registry);

        // transfer token ownership to controller
        trueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(trueUSD));

        // Setup Token controller
        tokenController.setToken(trueUSD);
        tokenController.setTokenRegistry(registry);
        
        // Point proxy to trueUSD address
        trueUSDProxy.upgradeTo(address(trueUSD));

        // Transfer ownership of proxy and controller to owner
        tokenController.transferOwnership(address(tokenControllerProxy));
        tokenControllerProxy.transferProxyOwnership(owner);
    }

    /// @dev Initialize Assurance
    function initAssurance() internal {
        // assurancePool is set up during constructor
        liquidator.claimOwnership();
        liquidator.setPool(address(assurancePool));
        assuredOpportunityProxy.claimProxyOwnership();
        

        assuredOpportunity.configure(
            address(financialOpportunity),
            address(assurancePool),
            address(liquidator),
            address(exponentContract),
            address(trueUSD)
        );


        // Transfer ownership to proxy
        assuredOpportunity.transferOwnership(address(assuredOpportunityProxy));
        assuredOpportunityProxy.upgradeTo(address(assuredOpportunity));

        // Transfer proxy to owner
        assuredOpportunityProxy.transferProxyOwnership(owner);
    }

    /**
     * @dev Set up contract interfaces
     */
    function setUpTrueUSD(
        address registryAddress,
        address trueUSDAddress,
        address payable trueUSDProxyAddress,
        address payable tokenControllerAddress,
        address payable tokenControllerProxyAddress
    ) internal {
        registry = Registry(registryAddress);
        trueUSD = TrueUSD(trueUSDAddress);
        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        tokenController = TokenController(tokenControllerAddress);
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
    }

    /**
     * @dev Set up contract interfaces
     */
    function setUpAssurance(
        address payable assuredOpportunityAddress,
        address payable assuredOpportunityProxyAddress,
        address financialOpportunityAddress,
        address exponentContractAddress,
        address assurancePoolAddress,
        address liquidatorAddress
    ) internal {
        assuredOpportunity = AssuredFinancialOpportunity(assuredOpportunityAddress);
        assuredOpportunityProxy =  OwnedUpgradeabilityProxy(assuredOpportunityProxyAddress);
        financialOpportunity = FinancialOpportunity(financialOpportunityAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
        liquidator = Liquidator(liquidatorAddress);
    }
}

