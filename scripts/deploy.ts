/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy.ts "{private_key}" "{network}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { Contract, ethers } from 'ethers'
import {
  deployBehindProxy,
  deployBehindTimeProxy,
  getContract,
  saveDeployResult,
  setupDeployer,
  validatePrivateKey,
} from './utils'
import { JsonRpcProvider, TransactionResponse } from 'ethers/providers'

interface DeployedAddresses {
  trueUsd: string,
  registry: string,
  aaveLendingPool: string,
  aTUSD: string,
  uniswapFactory: string,
}

const deployModes = {
  dev: {
    TokenController: 'TokenFaucet',
    TrustToken: 'MockTrustToken',
    AaveFinancialOpportunity: 'ConfigurableAaveFinancialOpportunity',
  },
  prod: {
    TokenController: 'TokenController',
    TrustToken: 'TrustToken',
    AaveFinancialOpportunity: 'AaveFinancialOpportunity'
  }
}

export async function deployWithExisting (accountPrivateKey: string, deployedAddresses: DeployedAddresses, provider: JsonRpcProvider, env: keyof typeof deployModes = 'prod') {
  let tx: TransactionResponse
  const result = {}

  const save = (contract: Contract, name: string) => {
    result[name] = contract.address
  }

  for (const [name, address] of Object.entries(deployedAddresses)) {
    const code = await provider.getCode(address)
    if (!code || code === '0x') {
      throw new Error(`Did not find contract ${name} under ${address} :(`)
    }
  }

  validatePrivateKey(accountPrivateKey)

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deploy = setupDeployer(wallet)

  const safeMath = await deploy('SafeMath')
  console.log('deployed SafeMath at: ', safeMath.address)

  const contractAt = getContract(wallet)
  const trueUSDImplementation = await deploy('TrueUSD')
  const trueUSDProxy = contractAt('OwnedUpgradeabilityProxy', deployedAddresses.trueUsd)
  const trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)
  save(trueUSD, 'trueUSD')

  const trueUsdOwner = await trueUSD.owner()
  if (trueUsdOwner !== wallet.address) {
    throw new Error(`${wallet.address} is not a TrueUSD owner.
Owner is: ${trueUsdOwner}`)
  }

  const registryImplementation = await deploy('ProvisionalRegistryImplementation')
  const registryProxy = contractAt('OwnedUpgradeabilityProxy', deployedAddresses.registry)
  const registry = registryImplementation.attach(registryProxy.address)
  save(registry, 'registry')

  const registryOwner = await registry.owner()
  if (registryOwner !== wallet.address) {
    throw new Error(`${wallet.address} is not a Registry owner.
Owner is: ${registryOwner}`)
  }

  // TODO change to real TokenController
  const tokenControllerImplementation = await deploy(deployModes[env].TokenController)
  const tokenControllerProxy = await deploy('OwnedUpgradeabilityProxy')
  const tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
  console.log('deployed tokenControllerProxy at: ', tokenControllerProxy.address)
  save(tokenController, 'tokenController')

  const assuredFinancialOpportunityImplementation = await deploy('AssuredFinancialOpportunity')
  const assuredFinancialOpportunityProxy = await deploy('OwnedUpgradeabilityProxy')
  const assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)
  console.log('deployed assuredFinancialOpportunityProxy at: ', assuredFinancialOpportunityProxy.address)
  save(assuredFinancialOpportunity, 'assuredFinancialOpportunity')

  const fractionalExponents = await deploy('FractionalExponents')
  save(fractionalExponents, 'fractionalExponents')

  // TODO change to real TrustToken
  const [trustTokenImplementation, trustTokenProxy, trustToken] = await deployBehindTimeProxy(wallet, deployModes[env].TrustToken)
  save(trustToken, 'trustToken')
  // TODO change to real AaveFinancialOpportunity
  const [financialOpportunityImplementation, financialOpportunityProxy] = await deployBehindProxy(wallet, deployModes[env].AaveFinancialOpportunity)
  save(financialOpportunityProxy, 'financialOpportunity')

  const lendingPool = contractAt('ILendingPool', deployedAddresses.aaveLendingPool)
  save(lendingPool, 'lendingPool')
  const aToken = contractAt('IAToken', deployedAddresses.aTUSD)
  save(aToken, 'aToken')

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
  result['trueUSDUniswapExchange'] = trueUSDUniswapExchange

  tx = await uniswapFactory.createExchange(trustToken.address, { gasLimit: 5_000_000 })
  await tx.wait()
  const trustTokenUniswapExchange = await uniswapFactory.getExchange(trustToken.address)
  console.log('created trustTokenUniswapExchange at: ', trustTokenUniswapExchange)
  result['trustTokenUniswapExchange'] = trustTokenUniswapExchange

  // deploy liquidator
  const liquidatorImplementation = await deploy('Liquidator')
  const liquidatorProxy = await deploy('OwnedUpgradeabilityProxy')
  save(liquidatorProxy, 'liquidator')
  console.log('deployed liquidatorProxy at: ', liquidatorProxy.address)

  // deploy assurance pool
  const [stakedTokenImplementation, stakedTokenProxy] = await deployBehindProxy(wallet, 'StakedToken')
  save(stakedTokenProxy, 'stakedToken')
  console.log('deployed stakedToken at: ', stakedTokenProxy.address)

  // Deploy UpgradeHelper
  const deployHelper = await deploy(
    'DeployHelper',
    trueUSDProxy.address,
    registryProxy.address,
    tokenControllerProxy.address,
    trustTokenProxy.address,
    assuredFinancialOpportunityProxy.address,
    financialOpportunityProxy.address,
    stakedTokenProxy.address,
    liquidatorProxy.address,
    fractionalExponents.address,
  )
  save(deployHelper, 'deployHelper')
  tx = await trueUSD.transferOwnership(deployHelper.address)
  await tx.wait()
  console.log('trueUSD transfer ownership')

  // transfer proxy ownership to deploy helper
  tx = await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('controller proxy transfer ownership')

  tx = await trustTokenProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('trust token proxy transfer ownership')

  tx = await trueUSDProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('trueUSDProxy proxy transfer ownership')

  tx = await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('assuredFinancialOpportunityProxy proxy transfer ownership')

  tx = await financialOpportunityProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('financialOpportunityProxy proxy transfer ownership')

  tx = await registryProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('registry proxy transfer ownership')

  tx = await liquidatorProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('liquidator proxy transfer ownership')

  tx = await stakedTokenProxy.transferProxyOwnership(deployHelper.address)
  await tx.wait()
  console.log('stakedToken proxy transfer ownership')

  // call deployHelper
  tx = await deployHelper.setup(
    trueUSDImplementation.address,
    registryImplementation.address,
    tokenControllerImplementation.address,
    trustTokenImplementation.address,
    assuredFinancialOpportunityImplementation.address,
    financialOpportunityImplementation.address,
    stakedTokenImplementation.address,
    liquidatorImplementation.address,
    aToken.address,
    lendingPool.address,
    trueUSDUniswapExchange,
    trustTokenUniswapExchange,
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('deployHelper: setup')

  // reclaim ownership
  tx = await tokenControllerProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenControllerProxy claim ownership')

  tx = await trustTokenProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('trust token claim ownership')

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

  tx = await stakedTokenProxy.claimProxyOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('stakedToken claim proxy ownership')

  tx = await tokenController.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('set mint thresholds')

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')

  return result
}

export const deploy = async (accountPrivateKey: string, provider: JsonRpcProvider, network: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployedAddresses: DeployedAddresses = require(`./deployedAddresses/${network}.json`)
  return deployWithExisting(accountPrivateKey, deployedAddresses, provider)
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }
  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deploy(process.argv[2], provider, process.argv[3])
    .then(saveDeployResult(process.argv[3]))
    .catch(console.error)
}
