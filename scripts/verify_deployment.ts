/**
 * Deploy verification script
 *
 * ts-node scripts/verify_deployment.ts "{network}" "{owner_address}"
 */
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { providers } from 'ethers'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'

const comp = (expected: string, actual: string, topic: string) => {
  if (expected.toLowerCase() === actual.toLowerCase()) {
    console.log(`${topic}: OK`)
  } else {
    console.log(`${topic}: Fail
Expected: ${expected}
Actual: ${actual}`,
    )
  }
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
})()
