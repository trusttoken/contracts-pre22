pragma solidity ^0.5.13;

import { Registry } from "@trusttoken/registry/contracts/Registry.sol";
import { TrueUSD } from "../TrueCurrencies/TrueUSD.sol";
import { ProvisionalRegistryImplementation } from "../mocks/RegistryImplementation.sol";
import { OwnedUpgradeabilityProxy } from "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import { TokenController } from "../TrueCurrencies/Admin/TokenController.sol";
import { AssuredFinancialOpportunity } from "../TrueReward/AssuredFinancialOpportunity.sol";
import { AaveFinancialOpportunity } from "../TrueReward/AaveFinancialOpportunity.sol";
import { IAToken } from "../TrueReward/IAToken.sol";
import { ILendingPool } from "../TrueReward/ILendingPool.sol";
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

    OwnedUpgradeabilityProxy public trueUSDProxy;
    OwnedUpgradeabilityProxy public tokenControllerProxy;
    OwnedUpgradeabilityProxy public registryProxy;
    OwnedUpgradeabilityProxy public assuredFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public aaveFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public liquidatorProxy;

    ProvisionalRegistryImplementation registry;
    IExponentContract exponentContract;
    StakedToken assurancePool;

    TrueUSD trueUSD;
    TokenController tokenController;
    AssuredFinancialOpportunity assuredFinancialOpportunity;
    AaveFinancialOpportunity aaveFinancialOpportunity;
    Liquidator liquidator;

    constructor(
        address payable trueUSDProxyAddress,
        address payable registryProxyAddress,
        address payable tokenControllerProxyAddress,
        address payable assuredFinancialOpportunityProxyAddress,
        address payable aaveFinancialOpportunityProxyAddress,
        address payable liquidatorProxyAddress,
        address exponentContractAddress,
        address assurancePoolAddress
    ) public {
        require(trueUSDProxyAddress != address(0), "trueUSDProxyAddress cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "tokenControllerProxyAddress cannot be address(0)");
        require(assuredFinancialOpportunityProxyAddress != address(0), "assuredFinancialOpportunityProxyAddress cannot be address(0)");
        require(aaveFinancialOpportunityProxyAddress != address(0), "aaveFinancialOpportunityProxyAddress cannot be address(0)");
        require(liquidatorProxyAddress != address(0), "liquidatorProxyAddress cannot be address(0)");
        require(registryProxyAddress != address(0), "registryProxyAddress cannot be address(0)");
        require(exponentContractAddress != address(0), "exponentContractAddress cannot be address(0)");
        require(assurancePoolAddress != address(0), "assurancePoolAddress cannot be address(0)");

        owner = msg.sender;

        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
        registryProxy = OwnedUpgradeabilityProxy(registryProxyAddress);
        assuredFinancialOpportunityProxy = OwnedUpgradeabilityProxy(assuredFinancialOpportunityProxyAddress);
        aaveFinancialOpportunityProxy = OwnedUpgradeabilityProxy(aaveFinancialOpportunityProxyAddress);
        liquidatorProxy = OwnedUpgradeabilityProxy(liquidatorProxyAddress);

        exponentContract = IExponentContract(exponentContractAddress);
        assurancePool = StakedToken(assurancePoolAddress);
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
        address trueUSDImplAddress,
        address registryImplAddress,
        address payable tokenControllerImplAddress,
        address payable assuredFinancialOpportunityImplAddress,
        address payable aaveFinancialOpportunityImplAddress,
        address payable liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address trustTokenAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) public onlyOwner {
        require(trueUSDImplAddress != address(0), "trueUSDImplAddress cannot be address(0)");
        require(tokenControllerImplAddress != address(0), "tokenControllerImplAddress cannot be address(0)");
        require(assuredFinancialOpportunityImplAddress != address(0), "assuredFinancialOpportunityImplAddress cannot be address(0)");
        require(aaveFinancialOpportunityImplAddress != address(0), "aaveFinancialOpportunityImplAddress cannot be address(0)");
        require(liquidatorImplAddress != address(0), "liquidatorImplAddress cannot be address(0)");

        initTrueUSD(
            trueUSDImplAddress,
            tokenControllerImplAddress,
            registryImplAddress
        );

        initAssurance(
            assuredFinancialOpportunityImplAddress,
            aaveFinancialOpportunityImplAddress,
            liquidatorImplAddress,
            aTokenAddress,
            lendingPoolAddress,
            trustTokenAddress,
            outputUniswapAddress,
            stakeUniswapAddress
        );
    }

    // @dev Init TrueUSD & TokenController
    function initTrueUSD(
        address trueUSDImplAddress,
        address tokenControllerImplAddress,
        address registryImplAddress
    ) internal {
        require(trueUSDProxy.pendingProxyOwner() == address(this), "not token proxy owner");
        require(tokenControllerProxy.pendingProxyOwner() == address(this), "not controller proxy owner");

        trueUSDProxy.claimProxyOwnership(); //pass
        trueUSDProxy.upgradeTo(trueUSDImplAddress);
        trueUSD = TrueUSD(address(trueUSDProxy));
        trueUSD.initialize();

        tokenControllerProxy.claimProxyOwnership();
        tokenControllerProxy.upgradeTo(tokenControllerImplAddress);
        tokenController = TokenController(address(tokenControllerProxy));
        tokenController.initialize();

        registryProxy.claimProxyOwnership();
        registryProxy.upgradeTo(registryImplAddress);
        registry = ProvisionalRegistryImplementation(address(registryProxy));

        // try to initialize contracts for ownership
        // ignore errors if contracts were initialized beforehand
        address(registry).call(abi.encodeWithSignature("initialize()"));
        address(tokenController).call(abi.encodeWithSignature("initialize()"));
        address(trueUSD).call(abi.encodeWithSignature("initialize()"));

        trueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(trueUSD));

        tokenController.setToken(trueUSD);
        tokenController.setTokenRegistry(registry);
        tokenController.setRegistry(registry);
        tokenController.setOpportunityAddress(address(assuredFinancialOpportunityProxy));

        trueUSDProxy.transferProxyOwnership(owner);
        tokenController.transferOwnership(owner);
        tokenControllerProxy.transferProxyOwnership(owner);
        registry.transferOwnership(owner);
        registryProxy.transferProxyOwnership(owner);
    }

    /// @dev Initialize Assurance
    function initAssurance(
        address assuredFinancialOpportunityImplAddress,
        address aaveFinancialOpportunityImplAddress,
        address liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address trustTokenAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) internal {
        assuredFinancialOpportunityProxy.claimProxyOwnership();
        assuredFinancialOpportunityProxy.upgradeTo(assuredFinancialOpportunityImplAddress);
        assuredFinancialOpportunity = AssuredFinancialOpportunity(address(assuredFinancialOpportunityProxy));

        aaveFinancialOpportunityProxy.claimProxyOwnership();
        aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImplAddress);
        aaveFinancialOpportunity = AaveFinancialOpportunity(address(aaveFinancialOpportunityProxy));

        liquidatorProxy.claimProxyOwnership();
        liquidatorProxy.upgradeTo(liquidatorImplAddress);
        liquidator = Liquidator(address(liquidatorProxy));

        liquidator.configure(
            address(registry),
            address(trueUSDProxy),
            trustTokenAddress,
            outputUniswapAddress,
            stakeUniswapAddress
        );
        liquidator.setPool(address(assurancePool));

        aaveFinancialOpportunity.configure(
            IAToken(aTokenAddress),
            ILendingPool(lendingPoolAddress),
            TrueUSD(trueUSD),
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

        liquidator.transferOwnership(address(assuredFinancialOpportunity));

        assuredFinancialOpportunity.claimLiquidatorOwnership();
        assuredFinancialOpportunity.transferOwnership(owner);

        liquidatorProxy.transferProxyOwnership(owner);
        assuredFinancialOpportunityProxy.transferProxyOwnership(owner);
        aaveFinancialOpportunityProxy.transferProxyOwnership(owner);
    }
}

