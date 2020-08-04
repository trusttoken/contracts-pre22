/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy.ts "{private_key}" "{network}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { Contract, ethers, Wallet } from 'ethers'
import {
  deployBehindProxy,
  deployBehindTimeProxy,
  getContract,
  saveDeployResult,
  setupDeployer,
  validatePrivateKey,
} from './utils'
import { JsonRpcProvider, TransactionResponse } from 'ethers/providers'
import { RegistryAttributes } from './attributes'
import { AddressZero } from 'ethers/constants'
import { TokenControllerFactory } from '../build/types/TokenControllerFactory'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'

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
    AaveFinancialOpportunity: 'AaveFinancialOpportunity',
  },
}

const checkDeployedContractOwner = async (wallet: Wallet, contract: Contract, proxy: Contract) => {
  const owner = await contract.owner()
  const proxyOwner = await proxy.proxyOwner()
  if (owner !== wallet.address || proxyOwner !== wallet.address) {
    throw new Error(`${wallet.address} is not an owner.
Owner is: ${owner}`)
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
  await checkDeployedContractOwner(wallet, trueUSD, trueUSDProxy)
  save(trueUSD, 'trueUSD')

  const registryImplementation = await deploy('ProvisionalRegistryImplementation')
  const registryProxy = contractAt('OwnedUpgradeabilityProxy', deployedAddresses.registry)
  const registry = registryImplementation.attach(registryProxy.address)
  await checkDeployedContractOwner(wallet, registry, registryProxy)
  save(registry, 'registry')

  const [tokenControllerImplementation, tokenControllerProxy, tokenController] = await deployBehindProxy(wallet, deployModes[env].TokenController)
  save(tokenController, 'tokenController')

  const [assuredFinancialOpportunityImplementation, assuredFinancialOpportunityProxy, assuredFinancialOpportunity] = await deployBehindProxy(wallet, 'AssuredFinancialOpportunity')
  save(assuredFinancialOpportunity, 'assuredFinancialOpportunity')

  const fractionalExponents = await deploy('FractionalExponents')
  save(fractionalExponents, 'fractionalExponents')

  const [trustTokenImplementation, trustTokenProxy, trustToken] = await deployBehindTimeProxy(wallet, deployModes[env].TrustToken)
  save(trustToken, 'trustToken')

  const [financialOpportunityImplementation, financialOpportunityProxy] = await deployBehindProxy(wallet, deployModes[env].AaveFinancialOpportunity)
  save(financialOpportunityProxy, 'financialOpportunity')

  const lendingPool = contractAt('ILendingPool', deployedAddresses.aaveLendingPool)
  save(lendingPool, 'lendingPool')

  const aToken = contractAt('IAToken', deployedAddresses.aTUSD)
  save(aToken, 'aToken')

  // setup uniswap
  const uniswapFactory = contractAt('uniswap_factory', deployedAddresses.uniswapFactory)
  let trueUSDUniswapExchange = await uniswapFactory.getExchange(trueUSDProxy.address)
  if (trueUSDUniswapExchange === AddressZero) {
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

  const [liquidatorImplementation, liquidatorProxy] = await deployBehindProxy(wallet, 'Liquidator')
  save(liquidatorProxy, 'liquidator')

  // deploy assurance pool
  const [stakedTokenImplementation, stakedTokenProxy] = await deployBehindProxy(wallet, 'StakedToken')
  save(stakedTokenProxy, 'stakedToken')

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

  const transferProxyOwnership = async (contractName: string) => {
    const proxy = contractAt('OwnedUpgradeabilityProxy', result[contractName])
    await (await proxy.transferProxyOwnership(deployHelper.address)).wait()
    console.log(`${contractName} proxy ownership transferred`)
  }

  const claimProxyOwnership = async (contractName: string) => {
    const proxy = contractAt('OwnedUpgradeabilityProxy', result[contractName])
    await (await proxy.claimProxyOwnership({ gasLimit: 5000000 })).wait()
    console.log(`${contractName} proxy ownership claimed`)
  }

  await transferProxyOwnership('tokenController')
  await transferProxyOwnership('trustToken')
  await transferProxyOwnership('trueUSD')
  await transferProxyOwnership('assuredFinancialOpportunity')
  await transferProxyOwnership('financialOpportunity')
  await transferProxyOwnership('registry')
  await transferProxyOwnership('liquidator')
  await transferProxyOwnership('stakedToken')

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

  await claimProxyOwnership('tokenController')
  await claimProxyOwnership('trustToken')
  await claimProxyOwnership('trueUSD')
  await claimProxyOwnership('assuredFinancialOpportunity')
  await claimProxyOwnership('financialOpportunity')
  await claimProxyOwnership('registry')
  await claimProxyOwnership('liquidator')
  await claimProxyOwnership('stakedToken')

  tx = await trustToken.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('trustToken claim ownership')

  tx = await assuredFinancialOpportunity.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('assuredFinancialOpportunity claim ownership')

  tx = await tokenController.claimOwnership({ gasLimit: 5000000 })
  await tx.wait()
  console.log('tokenController claim ownership')

  tx = await tokenController.setMintThresholds(
    ethers.utils.bigNumberify('1000000000000000000000'),
    ethers.utils.bigNumberify('10000000000000000000000'),
    ethers.utils.bigNumberify('100000000000000000000000'),
    { gasLimit: 5000000 },
  )
  await tx.wait()
  console.log('set mint thresholds')

  await (await registry.setAttributeValue(stakedTokenProxy.address, RegistryAttributes.isRegisteredContract.hex, 1)).wait()

  if (env !== 'prod') {
    await (await registry.setAttributeValue(tokenController.address, '0x510fbb41b5c476bac182f85ede67db73632f6716af19f30eb5012ce6eb943dd8', 1)).wait()
    await (await registry.setAttributeValue(tokenController.address, '0x1bdd621d91a933d9cb446a4db070dbf8a4ac650038f025729be0212312b98993', 1)).wait()
    console.log('Faucet permissions granted')
  }

  await postDeployCheck(result, wallet)

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')

  return result
}

const validateWireing = (actual: string, expected: string) => {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Expected ${actual} to equal ${expected}`)
  }
}

const postDeployCheck = async (deployResult: Record<string, string>, wallet: Wallet) => {
  const tokenController = TokenControllerFactory.connect(deployResult.tokenController, wallet)
  validateWireing(await tokenController.token(), deployResult.trueUSD)
  validateWireing(await tokenController.registry(), deployResult.registry)
  validateWireing(await tokenController.owner(), wallet.address)
  const trueUsd = TrueUsdFactory.connect(deployResult.trueUSD, wallet)
  validateWireing(await trueUsd.opportunity(), deployResult.assuredFinancialOpportunity)
  validateWireing(await trueUsd.registry(), deployResult.registry)
  validateWireing(await trueUsd.owner(), deployResult.tokenController)
  const assuredFinancialOpportunity = AssuredFinancialOpportunityFactory.connect(deployResult.assuredFinancialOpportunity, wallet)
  validateWireing(await assuredFinancialOpportunity.finOp(), deployResult.financialOpportunity)
  validateWireing(await assuredFinancialOpportunity.pool(), deployResult.stakedToken)
  validateWireing(await assuredFinancialOpportunity.liquidator(), deployResult.liquidator)
  validateWireing(await assuredFinancialOpportunity.exponents(), deployResult.fractionalExponents)
  validateWireing(await assuredFinancialOpportunity.token(), deployResult.trueUSD)
  validateWireing(await assuredFinancialOpportunity.owner(), wallet.address)
  const aaveFinOp = AaveFinancialOpportunityFactory.connect(deployResult.financialOpportunity, wallet)
  validateWireing(await aaveFinOp.lendingPool(), deployResult.lendingPool)
  validateWireing(await aaveFinOp.aToken(), deployResult.aToken)
  validateWireing(await aaveFinOp.token(), deployResult.trueUSD)
  validateWireing(await aaveFinOp.owner(), deployResult.assuredFinancialOpportunity)
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
