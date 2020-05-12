/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy.ts "{private_key}" "{network}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { ethers } from 'ethers'
import { getContract, setupDeployer, validatePrivateKey } from './utils'
import { JsonRpcProvider, TransactionResponse } from 'ethers/providers'

interface DeployedAddresses {
  trueUsd: string,
  registry: string,
  aaveLendingPool: string,
  aTUSD: string,
  uniswapFactory: string,
}

export async function deployWithExisting (accountPrivateKey: string, deployedAddresses: DeployedAddresses, provider: JsonRpcProvider) {
  validatePrivateKey(accountPrivateKey)

  for (const [name, address] of Object.entries(deployedAddresses)) {
    const code = await provider.getCode(address)
    if (!code || code === '0x') {
      throw new Error(`Did not find contract ${name} under ${address} :(`)
    }
  }

  let tx: TransactionResponse

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deploy = setupDeployer(wallet)
  const contractAt = getContract(wallet)

  const safeMath = await deploy('SafeMath')
  console.log('deployed SafeMath at: ', safeMath.address)

  const trueUSDImplementation = await deploy('TrueUSD')
  const trueUSDProxy = contractAt('OwnedUpgradeabilityProxy', deployedAddresses.trueUsd)
  const trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)

  const trueUsdOwner = await trueUSD.owner()
  if (trueUsdOwner !== wallet.address) {
    throw new Error(`${wallet.address} is not a TrueUSD owner.
Owner is: ${trueUsdOwner}`)
  }

  const registryImplementation = await deploy('ProvisionalRegistryImplementation')
  const registryProxy = contractAt('OwnedUpgradeabilityProxy', deployedAddresses.registry)
  const registry = registryImplementation.attach(registryProxy.address)

  const registryOwner = await registry.owner()
  if (registryOwner !== wallet.address) {
    throw new Error(`${wallet.address} is not a Registry owner.
Owner is: ${trueUsdOwner}`)
  }

  const tokenControllerImplementation = await deploy('TokenController')
  const tokenControllerProxy = await deploy('OwnedUpgradeabilityProxy')
  const tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
  console.log('deployed tokenControllerProxy at: ', tokenControllerProxy.address)

  const assuredFinancialOpportunityImplementation = await deploy('AssuredFinancialOpportunity')
  const assuredFinancialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  const assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)
  console.log('deployed assuredFinancialOpportunityProxy at: ', assuredFinancialOpportunityProxy.address)

  // Deploy the rest of the contracts
  const lendingPool = contractAt('ILendingPool', deployedAddresses.aaveLendingPool)
  const aToken = contractAt('IAToken', deployedAddresses.aTUSD)
  const fractionalExponents = await deploy('FractionalExponents')

  const trustTokenImplementation = await deploy('MockTrustToken', registryProxy.address)
  const trustTokenProxy = await deploy('OwnedUpgradeabilityProxy')
  const trustToken = trustTokenImplementation.attach(trustTokenProxy.address)

  // const [trustTokenImplementation, trustTokenProxy, trustToken] = await deployBehindTimeProxy(wallet, 'MockTrustToken', registryProxy.address)
  tx = await trustTokenProxy.upgradeTo(trustTokenImplementation.address)
  await tx.wait()
  tx = await trustToken.initialize()
  await tx.wait()

  const financialOpportunityImplementation = await deploy('AaveFinancialOpportunity')
  const financialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  console.log('deployed aaveFinancialOpportunityProxy at: ', financialOpportunityProxy.address)

  // setup uniswap
  const uniswapFactory = contractAt('uniswap_factory', deployedAddresses.uniswapFactory)
  let trueUSDUniswapExchange = await uniswapFactory.getExchange(trueUSDProxy.address)
  if (trueUSDUniswapExchange === '0x0000000000000000000000000000000000000000') {
    tx = await uniswapFactory.createExchange(trueUSDProxy.address, { gasLimit: 5_000_000 })
    await tx.wait()
    trueUSDUniswapExchange = await uniswapFactory.getExchange(trueUSDProxy.address)
    console.log('created trueUSDUniswapExchange at: ', trueUSDUniswapExchange)
  } else {
    console.log('trueUSDUniswapExchange found at: ', trueUSDUniswapExchange)
  }

  tx = await uniswapFactory.createExchange(trustToken.address, { gasLimit: 5_000_000 })
  await tx.wait()
  const trustTokenUniswapExchange = await uniswapFactory.getExchange(trustToken.address)
  console.log('created trustTokenUniswapExchange at: ', trustTokenUniswapExchange)

  // deploy liquidator
  const liquidatorImplementation = await deploy('Liquidator')
  const liquidatorProxy = await deploy('OwnedUpgradeabilityProxy')
  const liquidator = liquidatorImplementation.attach(liquidatorProxy.address)

  // deploy assurance pool
  const assurancePool = await deploy(
    'StakedToken',
    trustTokenProxy.address,
    trueUSDProxy.address,
    registryProxy.address,
    liquidator.address,
  )

  // Deploy UpgradeHelper
  const deployHelper = await deploy(
    'DeployHelper',
    trueUSDProxy.address,
    registryProxy.address,
    tokenControllerProxy.address,
    trustTokenProxy.address,
    assuredFinancialOpportunityProxy.address,
    financialOpportunityProxy.address,
    liquidatorProxy.address,
    fractionalExponents.address,
    assurancePool.address,
  )

  // transfer proxy ownership to deploy helper
  tx = await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('controller proxy transfer ownership')

  tx = await trueUSDProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('trueUSDProxy proxy transfer ownership')

  tx = await trueUSD.transferOwnership(deployHelper.address)
  await tx.wait()
  console.log('trueUSDP transfer ownership')

  tx = await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('assuredFinancialOpportunityProxy proxy transfer ownership')

  tx = await financialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('financialOpportunityProxy proxy transfer ownership')

  tx = await liquidatorProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('liquidator transfer proxy ownership')

  tx = await registryProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('registry transfer proxy ownership')

  // call deployHelper
  tx = await deployHelper.setup(
    trueUSDImplementation.address,
    registryImplementation.address,
    tokenControllerImplementation.address,
    trustTokenImplementation.address,
    assuredFinancialOpportunityImplementation.address,
    financialOpportunityImplementation.address,
    liquidatorImplementation.address,
    aToken.address,
    lendingPool.address,
    trueUSDUniswapExchange,
    trueUSDUniswapExchange,
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('deployHelper: setup')

  // reclaim ownership
  tx = await tokenControllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenControllerProxy claim ownership')

  tx = await trueUSDProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('trueUSDProxy claim ownership')

  tx = await assuredFinancialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('assuredFinancialOpportunityProxy claim ownership')

  tx = await financialOpportunityProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('financialOpportunityProxy claim ownership')

  tx = await assuredFinancialOpportunity.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('assuredFinancialOpportunity claim ownership')

  tx = await tokenController.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenController claim ownership')

  tx = await registryProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('registry claim proxy ownership')

  tx = await liquidatorProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('liquidator claim proxy ownership')

  tx = await tokenController.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')
}

export const deploy = async (accountPrivateKey: string, provider: JsonRpcProvider, network: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployedAddresses: DeployedAddresses = require(`./deployedAddresses/${network}.json`)
  await deployWithExisting(accountPrivateKey, deployedAddresses, provider)
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }
  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deploy(process.argv[2], provider, process.argv[3]).catch(console.error)
}
