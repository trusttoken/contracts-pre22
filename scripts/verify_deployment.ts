/**
 * Deploy verification script
 *
 * ts-node scripts/verify_deployment.ts "{network}" "{owner_address}"
 */
import { providers } from 'ethers'
import { Provider } from 'ethers/providers'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { ProvisionalRegistryImplementation } from '../build/types/ProvisionalRegistryImplementation';
import { ProvisionalRegistryImplementationFactory } from '../build/types/ProvisionalRegistryImplementationFactory'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { RegistryAttributes } from './attributes'

const comp = (expected: string, actual: string, topic: string) => {
  if (expected.toLowerCase() === actual.toLowerCase()) {
    console.log(`${topic}: ✅`)
  } else {
    console.log(`${topic}: ❌
Expected: ${expected}
Actual: ${actual}`,
    )
  }
}

async function isSubscriber (provider: Provider, registry: ProvisionalRegistryImplementation, attribute: string, subscriber: string) {
  const startTopics = registry.filters.StartSubscription(attribute, subscriber).topics
  const stopTopics = registry.filters.StopSubscription(attribute, subscriber).topics
  async function startLogs() {
    return provider.getLogs({
      fromBlock: 1,
      topics: startTopics,
      address: registry.address
    })
  }
  async function stopLogs() {
    return provider.getLogs({
      fromBlock: 1,
      topics: stopTopics,
      address: registry.address
    })
  }
  const starts = await startLogs()
  const stops = await stopLogs()
  const all = [...starts, ...stops]
  const allSorted = all.sort((lhs, rhs) => lhs.blockNumber - rhs.blockNumber)
  return allSorted[allSorted.length - 1].topics[0] === startTopics[0]
}

interface DeployResult {
  trueUSD: string,
  tokenController: string,
  registry: string,
  assuredFinancialOpportunity: string,
  fractionalExponents: string,
  trustToken: string,
  financialOpportunity: string,
  lendingPool: string,
  aToken: string,
  trueUSDUniswapExchange: string,
  trustTokenUniswapExchange: string,
  liquidator: string,
  stakedToken: string,
  implementations: {
    trueUsd: string,
    tokenController: string,
    assuredFinancialOpportunity: string,
    trustToken: string,
    financialOpportunity: string,
    liquidator: string,
    stakedToken: string,
  },
  deployHelper: string,
}

(async () => {
  const network = process.argv[2]
  const owner = process.argv[3]
  const provider = new providers.InfuraProvider(network, '81447a33c1cd4eb09efb1e8c388fb28e')
  const deployResult = require(`./deploy/${network}.json`) as DeployResult

  const tusdProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.trueUSD, provider)
  comp(deployResult.implementations.trueUsd, await tusdProxy.implementation(), 'TrueUSD implementation')
  const controllerProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.tokenController, provider)
  comp(deployResult.implementations.tokenController, await controllerProxy.implementation(),
    'TokenController implementation')
  const tusd = TrueUsdFactory.connect(deployResult.trueUSD, provider)
  comp(deployResult.assuredFinancialOpportunity, await tusd.opportunity(), 'TrueUSD Financial Opportunity')

  const ttProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.trustToken, provider)
  comp(owner, await ttProxy.proxyOwner(), 'TrustToken proxy owner')
  const liquidatorProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.liquidator, provider)
  comp(owner, await liquidatorProxy.proxyOwner(), 'Liquidator proxy owner')
  const afoProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.assuredFinancialOpportunity, provider)
  comp(owner, await afoProxy.proxyOwner(), 'AssuredFinancialOpportunity proxy owner')
  const stakedTokenProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.stakedToken, provider)
  comp(owner, await stakedTokenProxy.proxyOwner(), 'StakedToken proxy owner')

  const trustToken = TrueUsdFactory.connect(deployResult.trustToken, provider)
  comp(owner, await trustToken.owner(), 'TrustToken owner')
  const assuredFinancialOpportunity = AssuredFinancialOpportunityFactory.connect(deployResult.assuredFinancialOpportunity, provider)
  comp(owner, await assuredFinancialOpportunity.owner(), 'AssuredFinancialOpportunity owner')

  const registry = ProvisionalRegistryImplementationFactory.connect(deployResult.registry, provider)
  for (const [attribute, contract] of [
    [RegistryAttributes.isRegisteredContract, 'trustToken'],
    [RegistryAttributes.isRegisteredContract, 'trueUSD'],
    [RegistryAttributes.isDepositAddress, 'trueUSD'],
    [RegistryAttributes.isBlacklisted, 'trueUSD'],
    [RegistryAttributes.isTrueRewardsWhitelisted, 'trueUSD'],
    [RegistryAttributes.approvedBeneficiary, 'liquidator'],
  ] as [{name: string, hex: string}, string][]) {
    if (await isSubscriber(provider, registry, attribute.hex, deployResult[contract])) {
      console.log(`${contract} subscription to ${attribute.name}: ✅`)
    } else {
      console.log(`${contract} subscription to ${attribute.name}: ❌`)
      console.log(`Attribute: ${attribute.hex}`)
    }
  }

  if ((await registry.getAttributeValue(stakedTokenProxy.address, RegistryAttributes.isRegisteredContract.hex)).eq(1)) {
    console.log('StakedToken is registered contract: ✅')
  } else {
    console.log('StakedToken is registered contract: ❌')
    console.log(`Attribute: ${RegistryAttributes.isRegisteredContract.hex}`)
  }

  if ((await registry.getAttributeValue(assuredFinancialOpportunity.address, RegistryAttributes.approvedBeneficiary.hex)).eq(1)) {
    console.log('AssuredFinancialOpportunity is approved beneficiary: ✅')
  } else {
    console.log('AssuredFinancialOpportunity is approved beneficiary: ❌')
    console.log(`Attribute: ${RegistryAttributes.approvedBeneficiary.hex}`)
  }
})()
