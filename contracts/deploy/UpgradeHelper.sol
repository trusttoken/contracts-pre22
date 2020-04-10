pragma solidity ^0.5.13;

import { OwnedUpgradeabilityProxy } from "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import { TrueRewardBackedToken } from "../TrueCurrencies/TrueRewardBackedToken.sol";
import { AssuredFinancialOpportunity } from "../TrueReward/AssuredFinancialOpportunity.sol";

contract UpgradeHelper {
    function performUpgrade(
        OwnedUpgradeabilityProxy trueUsdProxy,
        address newTrueUsdImplementation,
        OwnedUpgradeabilityProxy assuredOpportunityProxy,
        address assuredOpportunityImplementation,
        address mockedOpportunity,
        address exponentContractAddress,
        OwnedUpgradeabilityProxy tokenControllerProxy,
        address tokenControllerImplmentation
    ) external {
        
        initAssuredFinancialOpportunity(
            assuredOpportunityProxy,
            assuredOpportunityImplementation,
            mockedOpportunity,
            exponentContractAddress,
            address(trueUsdProxy)
        );

        initTrueUsd(
            trueUsdProxy,
            newTrueUsdImplementation,
            assuredOpportunityProxy
        );

        upgradeTokenController(
            tokenControllerProxy,
            tokenControllerImplmentation
        );
    }

    function initAssuredFinancialOpportunity(
        OwnedUpgradeabilityProxy assuredOpportunityProxy,
        address assuredOpportunityImplementation,
        address mockedOpportunity,
        address exponentContractAddress,
        address trueRewardBackedTokenAddress
    ) internal {
        address proxyOwner = assuredOpportunityProxy.proxyOwner();
        assuredOpportunityProxy.claimProxyOwnership();

        assuredOpportunityProxy.upgradeTo(assuredOpportunityImplementation);

        AssuredFinancialOpportunity assuredOpportunity = AssuredFinancialOpportunity(address(assuredOpportunityProxy));
        assuredOpportunity.configure(
            mockedOpportunity, // address _opportunityAddress
            address(0), // address _assuranceAddress
            address(0), // address _liquidatorAddress
            exponentContractAddress, // address _exponentContractAddress
            trueRewardBackedTokenAddress // address _trueRewardBackedTokenAddress
        );

        assuredOpportunityProxy.transferProxyOwnership(proxyOwner);
        assuredOpportunity.transferOwnership(proxyOwner);
    }

  function initTrueUsd(
        OwnedUpgradeabilityProxy trueUsdProxy,
        address newTrueUsdImplementation,
        OwnedUpgradeabilityProxy assuredOpportunityProxy
    ) internal {
        address trueUsdProxyOwner = trueUsdProxy.proxyOwner();
        trueUsdProxy.claimProxyOwnership();

        trueUsdProxy.upgradeTo(newTrueUsdImplementation);
        trueUsdProxy.transferProxyOwnership(trueUsdProxyOwner);

        TrueRewardBackedToken trueUsd = TrueRewardBackedToken(address(trueUsdProxy));
        address trueUsdOwner = trueUsd.owner();
        trueUsd.claimOwnership();

        trueUsd.setAaveInterfaceAddress(address(assuredOpportunityProxy));

        trueUsd.transferOwnership(trueUsdOwner);
    }

    function upgradeTokenController(
        OwnedUpgradeabilityProxy proxy,
        address implementation
    ) internal {
        address owner = proxy.proxyOwner();
        proxy.claimProxyOwnership();
        proxy.upgradeTo(implementation);
        proxy.transferProxyOwnership(owner);
    }
}

