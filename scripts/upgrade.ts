/**
 * Ethers Upgrade Script
 *
 * ts-node scripts/upgrade.ts "{deploy_helper_address}" "{private_key}" "{rpc_url}"
 *
 * We use ethers to deploy our contracts.
 * Use the config object to set parameters for deployment
 *
 */

import { ethers, providers } from 'ethers'
import { getContract, setupDeployer, validateAddress, validatePrivateKey } from './utils'

export const upgrade = async (deployHelperAddress: string, accountPrivateKey: string, provider: providers.JsonRpcProvider) => {
  validateAddress(deployHelperAddress)
  validatePrivateKey(accountPrivateKey)

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deploy = setupDeployer(wallet)
  const contract = getContract(wallet)
  // Deploy all contracts
  const trueUSDContract = await deploy('TrueUSD')
  const tokenControllerContract = await deploy('TokenController')
  const aaveFinancialOpportunityContract = await deploy('AaveFinancialOpportunity')
  const assuredFinancialOpportunityContract = await deploy('AssuredFinancialOpportunity')
  const liquidatorContract = await deploy('Liquidator')
  const registryContract = await deploy('ProvisionalRegistryImplementation')

  const deployHelper = contract('DeployHelper', deployHelperAddress)
  const tokenControllerProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.tokenControllerProxy())
  const trueUsdProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.trueUSDProxy())
  const assuredFinancialOpportunityProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.assuredFinancialOpportunityProxy())
  const aaveFinancialOpportunityProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.aaveFinancialOpportunityProxy())
  const liquidatorProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.liquidatorProxy())
  const registryProxy = contract('OwnedUpgradeabilityProxy', await deployHelper.registryProxy())

  console.log('Upgrading TrueUSD...')
  await (await trueUsdProxy.upgradeTo(trueUSDContract.address)).wait()
  console.log('Upgrading TokenController...')
  await (await tokenControllerProxy.upgradeTo(tokenControllerContract.address)).wait()
  console.log('Upgrading AssuredFinancialOpportunity...')
  await (await assuredFinancialOpportunityProxy.upgradeTo(assuredFinancialOpportunityContract.address)).wait()
  console.log('Upgrading AaveFinancialOpportunity...')
  await (await aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityContract.address)).wait()
  console.log('Upgrading Liquidator...')
  await (await liquidatorProxy.upgradeTo(liquidatorContract.address)).wait()
  console.log('Upgrading Registry...')
  await (await registryProxy.upgradeTo(registryContract.address)).wait()

  console.log('\n\nSUCCESSFULLY UPGRADED', '\n\n')
}

if (require.main === module) {
  if (process.argv.length < 4) {
    console.log(`Usage:
  upgrade deployHelperAddress accountPrivateKey [rpcURL]
`)
    throw new Error()
  }
  const provider = new providers.JsonRpcProvider(process.argv[4] || 'http://localhost:7545')
  upgrade(process.argv[2], process.argv[3], provider).catch(console.error)
}
