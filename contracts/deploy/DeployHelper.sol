pragma solidity ^0.5.13;

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
import { TrustToken } from "@trusttoken/trusttokens/contracts/TrustToken.sol";
import { StakingAsset } from "@trusttoken/trusttokens/contracts/StakingAsset.sol";

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
    OwnedUpgradeabilityProxy public registryProxy;
    OwnedUpgradeabilityProxy public tokenControllerProxy;
    OwnedUpgradeabilityProxy public trustTokenProxy;
    OwnedUpgradeabilityProxy public assuredFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public aaveFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public stakedTokenProxy;
    OwnedUpgradeabilityProxy public liquidatorProxy;

    IExponentContract exponentContract;
    StakedToken stakedToken;

    TrueUSD trueUSD;
    TokenController tokenController;
    TrustToken trustToken;
    AssuredFinancialOpportunity assuredFinancialOpportunity;
    AaveFinancialOpportunity aaveFinancialOpportunity;
    Liquidator liquidator;
    ProvisionalRegistryImplementation registry;

    /**
     * @dev Set proxy & exponent contract addresses in storage
     */
    constructor(
        address payable trueUSDProxyAddress,
        address payable registryProxyAddress,
        address payable tokenControllerProxyAddress,
        address payable trustTokenProxyAddress,
        address payable assuredFinancialOpportunityProxyAddress,
        address payable aaveFinancialOpportunityProxyAddress,
        address payable stakedTokenProxyAddress,
        address payable liquidatorProxyAddress,
        address exponentContractAddress
    ) public {
        require(trueUSDProxyAddress != address(0), "trueUSDProxyAddress cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "tokenControllerProxyAddress cannot be address(0)");
        require(trustTokenProxyAddress != address(0), "trustTokenProxyAddress cannot be address(0)");
        require(assuredFinancialOpportunityProxyAddress != address(0), "assuredFinancialOpportunityProxyAddress cannot be address(0)");
        require(aaveFinancialOpportunityProxyAddress != address(0), "aaveFinancialOpportunityProxyAddress cannot be address(0)");
        require(stakedTokenProxyAddress != address(0), "stakedTokenAddress cannot be address(0)");
        require(liquidatorProxyAddress != address(0), "liquidatorProxyAddress cannot be address(0)");
        require(registryProxyAddress != address(0), "registryProxyAddress cannot be address(0)");
        require(exponentContractAddress != address(0), "exponentContractAddress cannot be address(0)");

        owner = msg.sender;

        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
        trustTokenProxy = OwnedUpgradeabilityProxy(trustTokenProxyAddress);
        registryProxy = OwnedUpgradeabilityProxy(registryProxyAddress);
        assuredFinancialOpportunityProxy = OwnedUpgradeabilityProxy(assuredFinancialOpportunityProxyAddress);
        aaveFinancialOpportunityProxy = OwnedUpgradeabilityProxy(aaveFinancialOpportunityProxyAddress);
        liquidatorProxy = OwnedUpgradeabilityProxy(liquidatorProxyAddress);
        registryProxy = OwnedUpgradeabilityProxy(registryProxyAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        stakedTokenProxy = OwnedUpgradeabilityProxy(stakedTokenProxyAddress);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /**
     * @dev Setup TrueUSD
     * msg.sender needs to own all the deployed contracts
     * msg.sender needs to transfer ownership to this contract for:
     * trueUSD, trueUSDProxy, tokenController, tokenControllerProxy,
     * liquidator
     */
    function setup(
        address trueUSDImplAddress,
        address payable registryImplAddress,
        address payable tokenControllerImplAddress,
        address payable trustTokenImplAddress,
        address payable assuredFinancialOpportunityImplAddress,
        address payable aaveFinancialOpportunityImplAddress,
        address payable stakedTokenImplAddress,
        address payable liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) public onlyOwner {
        require(trueUSDImplAddress != address(0), "trueUSDImplAddress cannot be address(0)");
        require(tokenControllerImplAddress != address(0), "tokenControllerImplAddress cannot be address(0)");
        require(trustTokenImplAddress != address(0), "trustTokenImplAddress cannot be address(0)");
        require(assuredFinancialOpportunityImplAddress != address(0), "assuredFinancialOpportunityImplAddress cannot be address(0)");
        require(aaveFinancialOpportunityImplAddress != address(0), "aaveFinancialOpportunityImplAddress cannot be address(0)");
        require(stakedTokenImplAddress != address(0), "stakedTokenImplAddress cannot be address(0)");
        require(liquidatorImplAddress != address(0), "liquidatorImplAddress cannot be address(0)");
        require(registryImplAddress != address(0), "registryImplAddress cannot be address(0)");

        initTrueUSD(
            trueUSDImplAddress,
            tokenControllerImplAddress,
            registryImplAddress
        );

        trustToken = TrustToken(address(trustTokenProxy));

        initAssurance(
            assuredFinancialOpportunityImplAddress,
            aaveFinancialOpportunityImplAddress,
            stakedTokenImplAddress,
            liquidatorImplAddress,
            aTokenAddress,
            lendingPoolAddress,
            outputUniswapAddress,
            stakeUniswapAddress
        );
    }

    /**
     * @dev Init TrueUSD & TokenController
     */
    function initTrueUSD(
        address trueUSDImplAddress,
        address tokenControllerImplAddress,
        address registryImplAddress
    ) internal {
        require(trueUSDProxy.pendingProxyOwner() == address(this), "not token proxy owner");
        require(tokenControllerProxy.pendingProxyOwner() == address(this), "not controller proxy owner");
        require(registryProxy.pendingProxyOwner() == address(this), "not registry proxy owner");

        trueUSDProxy.claimProxyOwnership();
        trueUSDProxy.upgradeTo(trueUSDImplAddress);
        trueUSD = TrueUSD(address(trueUSDProxy));

        // Either initialize or claim ownership
        address(trueUSD).call(abi.encodeWithSignature("initialize()"));
        address(trueUSD).call(abi.encodeWithSignature("claimOwnership()"));
        require(trueUSD.owner() == address(this), "not TrueUSD owner");

        tokenControllerProxy.claimProxyOwnership();
        tokenControllerProxy.upgradeTo(tokenControllerImplAddress);
        tokenController = TokenController(address(tokenControllerProxy));
        tokenController.initialize();

        trueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(trueUSD));

        registryProxy.claimProxyOwnership();
        registryProxy.upgradeTo(registryImplAddress);
        registry = ProvisionalRegistryImplementation(address(registryProxy));
        address(registry).call(abi.encodeWithSignature("initialize()"));

        tokenController.setToken(trueUSD);
        tokenController.setTokenRegistry(registry);
        tokenController.setRegistry(registry);
        tokenController.setOpportunityAddress(address(assuredFinancialOpportunityProxy));

        trueUSDProxy.transferProxyOwnership(owner);
        tokenController.transferOwnership(owner);
        tokenControllerProxy.transferProxyOwnership(owner);
        registryProxy.transferProxyOwnership(owner);

        if (registry.owner() == address(this)) {
            registry.transferOwnership(owner);
        }
    }

    /// @dev Initialize Assurance
    function initAssurance(
        address assuredFinancialOpportunityImplAddress,
        address aaveFinancialOpportunityImplAddress,
        address stakedTokenImplAddress,
        address liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) internal {
        assuredFinancialOpportunityProxy.claimProxyOwnership();
        assuredFinancialOpportunityProxy.upgradeTo(assuredFinancialOpportunityImplAddress);
        assuredFinancialOpportunity = AssuredFinancialOpportunity(address(assuredFinancialOpportunityProxy));

        aaveFinancialOpportunityProxy.claimProxyOwnership();
        aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImplAddress);
        aaveFinancialOpportunity = AaveFinancialOpportunity(address(aaveFinancialOpportunityProxy));

        stakedTokenProxy.claimProxyOwnership();
        stakedTokenProxy.upgradeTo(stakedTokenImplAddress);
        stakedToken = StakedToken(address(stakedTokenProxy));

        stakedToken.configure(
            StakingAsset(trustTokenAddress),
            StakingAsset(address(trueUSDProxy)),
            ProvisionalRegistryImplementation(address(registryProxy)),
            address(liquidatorProxy)
        );

        liquidatorProxy.claimProxyOwnership();
        liquidatorProxy.upgradeTo(liquidatorImplAddress);
        liquidator = Liquidator(address(liquidatorProxy));

        liquidator.configure(
            address(registry),
            address(trueUSDProxy),
            address(trustTokenProxy),
            outputUniswapAddress,
            stakeUniswapAddress
        );

        liquidator.setPool(address(stakedToken));

        aaveFinancialOpportunity.configure(
            IAToken(aTokenAddress),
            ILendingPool(lendingPoolAddress),
            TrueUSD(trueUSD),
            address(assuredFinancialOpportunity)
        );

        assuredFinancialOpportunity.configure(
            address(aaveFinancialOpportunity),
            address(stakedToken),
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
        stakedTokenProxy.transferProxyOwnership(owner);
    }
}
