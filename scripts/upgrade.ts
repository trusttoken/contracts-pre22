/**
 * Ethers Upgrade Script
 *
 * ts-node scripts/upgrade.ts "{deploy_helper_address}" "{private_key}" "{rpc_url}"
 *
 * We use ethers to deploy our contracts.
 * Use the config object to set parameters for deployment
 *
 */

import { Contract, ethers, providers, Wallet } from 'ethers'
import { getContract, getContractJSON, setupDeployer, validateAddress, validatePrivateKey } from './utils'
import readline from 'readline'

const proxies = {
  TrueUSD: 'trueUSDProxy',
  ProvisionalRegistryImplementation: 'registryProxy',
  TokenController: 'tokenControllerProxy',
  AaveFinancialOpportunity: 'aaveFinancialOpportunityProxy',
  AssuredFinancialOpportunity: 'assuredFinancialOpportunityProxy',
  Liquidator: 'liquidatorProxy',
}

const performUpgrade = async (deployHelper: Contract, wallet: Wallet, proxy: Contract, contractName: string) => {
  const deploy = setupDeployer(wallet)

  console.log(`Deploying ${contractName}...`)
  const contract = await deploy(contractName)
  console.log(`Upgrading ${contractName}...`)
  await (await proxy.upgradeTo(contract.address)).wait()
  return proxy.address
}

const hasCodeChanged = async (proxy: Contract, contractName: string) => {
  const implementationAddress = await proxy.implementation()
  const deployedCode = await proxy.provider.getCode(implementationAddress)
  const bytecode = await getContractJSON(contractName).evm.deployedBytecode.object
  return `0x${bytecode}` !== deployedCode
}

const confirmUpgrade = async (contractName: string) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise<boolean>(resolve => {
    rl.question(`Update ${contractName}? (Y/n)`, (answer) => {
      rl.close()
      if (['n', 'no'].includes(answer.toLowerCase())) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

const upgradeContract = (deployHelper: Contract, wallet: Wallet, force = false) => {
  const contractAt = getContract(wallet)

  return async (contractName: keyof typeof proxies) => {
    const proxy = contractAt('OwnedUpgradeabilityProxy', await deployHelper[proxies[contractName]]())

    if (force) {
      return performUpgrade(deployHelper, wallet, proxy, contractName)
    }
    if (!await hasCodeChanged(proxy, contractName)) {
      console.log(`${contractName} unchanged, skipping`)
      return proxy.address
    }
    if (await confirmUpgrade(contractName)) {
      return performUpgrade(deployHelper, wallet, proxy, contractName)
    }
  }
}

export const upgrade = async (deployHelperAddress: string, accountPrivateKey: string, provider: providers.JsonRpcProvider, force: boolean) => {
  validateAddress(deployHelperAddress)
  validatePrivateKey(accountPrivateKey)

  const wallet = new ethers.Wallet(accountPrivateKey, provider)

  const deployHelper = getContract(wallet)('DeployHelper', deployHelperAddress)
  const doUpgrade = upgradeContract(deployHelper, wallet, force)
  await doUpgrade('TrueUSD')
  await doUpgrade('ProvisionalRegistryImplementation')
  await doUpgrade('TokenController')
  await doUpgrade('AssuredFinancialOpportunity')
  await doUpgrade('AaveFinancialOpportunity')
  await doUpgrade('Liquidator')

  console.log('\n\nSUCCESSFULLY UPGRADED ON NETWORK: ', provider.connection.url, '\n\n')
}

if (require.main === module) {
  if (process.argv.length < 4) {
    console.log(`Usage:
  upgrade deployHelperAddress accountPrivateKey [rpcURL]
`)
    throw new Error()
  }
  const provider = new providers.JsonRpcProvider(process.argv[4] || 'http://localhost:7545')
  const isForce = process.argv.includes('--force')
  upgrade(process.argv[2], process.argv[3], provider, isForce).catch(console.error)
}
