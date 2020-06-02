/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy_mainnet.ts "{private_key}" "{network}" "{owner_address}"
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
  txnArgs
} from './utils'
import { JsonRpcProvider, TransactionResponse } from 'ethers/providers'
import { AddressZero } from 'ethers/constants'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'

interface DeployedAddresses {
  trueUsd: string,
  tokenController: string,
  registry: string,
  aaveLendingPool: string,
  aTUSD: string,
  uniswapFactory: string,
}

export async function deployWithExisting (accountPrivateKey: string, deployedAddresses: DeployedAddresses, ownerAddress: string, provider: JsonRpcProvider) {
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

  const contractAt = getContract(wallet)
  const trueUsdImpl = await deploy('TrueUSD')
  const tokenControllerImpl = await deploy('TokenController')
  result['trueUSD'] = deployedAddresses.trueUsd
  result['tokenController'] = deployedAddresses.tokenController
  result['registry'] = deployedAddresses.registry

  const [assuredFinancialOpportunityImplementation, assuredFinancialOpportunityProxy, assuredFinancialOpportunity] = await deployBehindProxy(wallet, 'AssuredFinancialOpportunity')
  save(assuredFinancialOpportunity, 'assuredFinancialOpportunity')

  const fractionalExponents = await deploy('FractionalExponents')
  save(fractionalExponents, 'fractionalExponents')

  const [trustTokenImplementation, trustTokenProxy, trustToken] = await deployBehindTimeProxy(wallet, 'TrustToken')
  save(trustToken, 'trustToken')

  const [financialOpportunityImplementation, financialOpportunityProxy] = await deployBehindProxy(wallet, 'AaveFinancialOpportunity')
  save(financialOpportunityProxy, 'financialOpportunity')

  const lendingPool = contractAt('ILendingPool', deployedAddresses.aaveLendingPool)
  save(lendingPool, 'lendingPool')

  const aToken = contractAt('IAToken', deployedAddresses.aTUSD)
  save(aToken, 'aToken')

  // setup uniswap
  const uniswapFactory = contractAt('uniswap_factory', deployedAddresses.uniswapFactory)
  let trueUSDUniswapExchange = await uniswapFactory.getExchange(deployedAddresses.trueUsd, txnArgs)
  if (trueUSDUniswapExchange === AddressZero) {
    tx = await uniswapFactory.createExchange(deployedAddresses.trueUsd, txnArgs)
    await tx.wait()
    trueUSDUniswapExchange = await uniswapFactory.getExchange(deployedAddresses.trueUsd, txnArgs)
    console.log('created trueUSDUniswapExchange at: ', trueUSDUniswapExchange)
  } else {
    console.log('trueUSDUniswapExchange found at: ', trueUSDUniswapExchange)
  }
  result['trueUSDUniswapExchange'] = trueUSDUniswapExchange

  tx = await uniswapFactory.createExchange(trustToken.address, txnArgs)
  await tx.wait()
  const trustTokenUniswapExchange = await uniswapFactory.getExchange(trustToken.address, txnArgs)
  console.log('created trustTokenUniswapExchange at: ', trustTokenUniswapExchange)
  result['trustTokenUniswapExchange'] = trustTokenUniswapExchange

  const [liquidatorImplementation, liquidatorProxy] = await deployBehindProxy(wallet, 'Liquidator')
  save(liquidatorProxy, 'liquidator')

  // deploy assurance pool
  const [stakedTokenImplementation, stakedTokenProxy] = await deployBehindProxy(wallet, 'StakedToken')
  save(stakedTokenProxy, 'stakedToken')

  result['implementations'] = {
    trueUsd: trueUsdImpl.address,
    tokenController: tokenControllerImpl.address,
    assuredFinancialOpportunity: assuredFinancialOpportunityImplementation.address,
    trustToken: trustTokenImplementation.address,
    financialOpportunity: financialOpportunityImplementation.address,
    liquidator: liquidatorImplementation.address,
    stakedToken: stakedTokenImplementation.address,
  }

  const deployHelper = await deploy(
    'DeployHelper',
    deployedAddresses.trueUsd,
    deployedAddresses.registry,
    deployedAddresses.tokenController,
    trustTokenProxy.address,
    assuredFinancialOpportunityProxy.address,
    financialOpportunityProxy.address,
    stakedTokenProxy.address,
    liquidatorProxy.address,
    fractionalExponents.address,
    ownerAddress,
  )
  save(deployHelper, 'deployHelper')

  const transferProxyOwnership = async (contractName: string) => {
    const proxy = contractAt('OwnedUpgradeabilityProxy', result[contractName])
    await (await proxy.transferProxyOwnership(deployHelper.address, txnArgs)).wait()
    console.log(`${contractName} proxy ownership transferred`)
  }

  await transferProxyOwnership('trustToken')
  await transferProxyOwnership('assuredFinancialOpportunity')
  await transferProxyOwnership('financialOpportunity')
  await transferProxyOwnership('liquidator')
  await transferProxyOwnership('stakedToken')

  // call deployHelper
  tx = await deployHelper.setup(
    trustTokenImplementation.address,
    assuredFinancialOpportunityImplementation.address,
    financialOpportunityImplementation.address,
    stakedTokenImplementation.address,
    liquidatorImplementation.address,
    aToken.address,
    lendingPool.address,
    trueUSDUniswapExchange,
    trustTokenUniswapExchange,
    txnArgs
  )
  await tx.wait()
  console.log('deployHelper: setup')

  await postDeployCheck(result, wallet, ownerAddress)

  console.log('\n\nSUCCESSFULLY DEPLOYED TO NETWORK: ', provider.connection.url, '\n\n')
  console.log(`
  
  Next steps:
  * upgrade TrueUSD: upgradeTusdProxyImplTo(${trueUsdImpl.address}) 
  * upgrade TokenController: msUpgradeControllerProxyImplTo(${tokenControllerImpl.address})
  * set opportunity in TokenController: setOpportunityAddress(${assuredFinancialOpportunity.address})
  * claim Proxy ownerships in:
    * trustToken
    * assuredFinancialOpportunity
    * liquidator
    * stakedToken
  * claim ownerships in:
    * trustToken
    * assuredFinancialOpportunity
  * verify and setup controller (mint thresholds)
  * verify and setup registry 
`)

  return result
}

const validateWireing = (actual: string, expected: string) => {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Expected ${actual} to equal ${expected}`)
  }
}

const postDeployCheck = async (deployResult: Record<string, string>, wallet: Wallet, ownerAddress) => {
  const assuredFinancialOpportunity = AssuredFinancialOpportunityFactory.connect(deployResult.assuredFinancialOpportunity, wallet)
  const assuredFinancialOpportunityProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.assuredFinancialOpportunity, wallet)
  validateWireing(await assuredFinancialOpportunity.finOp(), deployResult.financialOpportunity)
  validateWireing(await assuredFinancialOpportunity.pool(), deployResult.stakedToken)
  validateWireing(await assuredFinancialOpportunity.liquidator(), deployResult.liquidator)
  validateWireing(await assuredFinancialOpportunity.exponents(), deployResult.fractionalExponents)
  validateWireing(await assuredFinancialOpportunity.token(), deployResult.trueUSD)
  validateWireing(await assuredFinancialOpportunity.pendingOwner(), ownerAddress)
  validateWireing(await assuredFinancialOpportunityProxy.pendingProxyOwner(), ownerAddress)
  const aaveFinOp = AaveFinancialOpportunityFactory.connect(deployResult.financialOpportunity, wallet)
  const aaveFinOpProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.financialOpportunity, wallet)
  validateWireing(await aaveFinOp.lendingPool(), deployResult.lendingPool)
  validateWireing(await aaveFinOp.aToken(), deployResult.aToken)
  validateWireing(await aaveFinOp.token(), deployResult.trueUSD)
  validateWireing(await aaveFinOp.owner(), deployResult.assuredFinancialOpportunity)
  validateWireing(await aaveFinOpProxy.pendingProxyOwner(), ownerAddress)
  const ttProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.trustToken, wallet)
  validateWireing(await ttProxy.pendingProxyOwner(), ownerAddress)
  const liquidatorProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.liquidator, wallet)
  validateWireing(await liquidatorProxy.pendingProxyOwner(), ownerAddress)
  const stakedTokenProxy = OwnedUpgradeabilityProxyFactory.connect(deployResult.stakedToken, wallet)
  validateWireing(await stakedTokenProxy.pendingProxyOwner(), ownerAddress)
}

export const deploy = async (accountPrivateKey: string, provider: JsonRpcProvider, network: string, ownerAddress: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const deployedAddresses: DeployedAddresses = require(`./deployedAddresses/${network}.json`)
  return deployWithExisting(accountPrivateKey, deployedAddresses, ownerAddress, provider)
}

if (require.main === module) {
  if (!['mainnet', 'kovan', 'ropsten', 'rinkeby'].includes(process.argv[3])) {
    throw new Error(`Unknown network: ${process.argv[3]}`)
  }
  try {
    ethers.utils.getAddress(process.argv[4])
  } catch (e) {
    throw new Error(`Invalid address: ${process.argv[4]}`)
  }

  const provider = new ethers.providers.InfuraProvider(process.argv[3], '81447a33c1cd4eb09efb1e8c388fb28e')
  deploy(process.argv[2], provider, process.argv[3], process.argv[4])
    .then(saveDeployResult(process.argv[3]))
    .catch(console.error)
}
