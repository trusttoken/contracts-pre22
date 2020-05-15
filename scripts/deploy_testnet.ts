/**
 * Ethers Deploy Script
 *
 * ts-node scripts/deploy_testnet.ts "{private_key}" "{rpc_url}"
 *
 * We use ethers to deploy our contracts from scratch.
 * For upgrades, use deploy/upgrade.ts
 * Use the config object to set parameters for deployment
 */

import { ContractFactory, ethers, providers, Wallet } from 'ethers'
import { saveDeployResult, validatePrivateKey } from './utils'
import { deployWithExisting } from './deploy'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { ProvisionalRegistryImplementationFactory } from '../build/types/ProvisionalRegistryImplementationFactory'
import { LendingPoolCoreMockFactory } from '../build/types/LendingPoolCoreMockFactory'
import { ATokenMockFactory } from '../build/types/ATokenMockFactory'
import { LendingPoolMockFactory } from '../build/types/LendingPoolMockFactory'
import { UniswapFactoryFactory } from '../build/types/UniswapFactoryFactory'
import { UniswapExchangeFactory } from '../build/types/UniswapExchangeFactory'

const rpcOptions = {
  rinkeby: 'https://rinkeby.infura.io/v3/81447a33c1cd4eb09efb1e8c388fb28e',
  development: 'http://localhost:7545',
}
const txWait = async (pending: Promise<ethers.ContractTransaction>) => {
  const tx = await pending
  return tx.wait()
}
export type Newable<T> = { new (...args: any[]): T };

const setupDeploy = (wallet: Wallet) => async <T extends ContractFactory>(Factory: Newable<T>, ...args: Parameters<T['deploy']>): Promise<ReturnType<T['deploy']>> => {
  const contract = await new Factory(wallet).deploy(...args)
  await contract.deployed()
  return contract
}

export const deploy = async (accountPrivateKey: string, provider: providers.JsonRpcProvider) => {
  validatePrivateKey(accountPrivateKey)
  const wallet = new ethers.Wallet(accountPrivateKey, provider)
  const deployWithWait = setupDeploy(wallet)

  const trueUSDImplementation = await deployWithWait(TrueUsdFactory)
  const trueUSDProxy = await deployWithWait(OwnedUpgradeabilityProxyFactory)
  await txWait(trueUSDProxy.upgradeTo(trueUSDImplementation.address))
  await txWait(trueUSDImplementation.attach(trueUSDProxy.address).initialize())
  console.log('deployed trueUSDProxy at: ', trueUSDProxy.address)

  const registryImplementation = await deployWithWait(ProvisionalRegistryImplementationFactory)
  const registryProxy = await deployWithWait(OwnedUpgradeabilityProxyFactory)
  await txWait(registryProxy.upgradeTo(registryImplementation.address))
  await txWait(registryImplementation.attach(registryProxy.address).initialize())
  console.log('deployed registryProxy at: ', registryProxy.address)

  const lendingPoolCoreMock = await deployWithWait(LendingPoolCoreMockFactory)
  const aTokenMock = await deployWithWait(ATokenMockFactory, trueUSDProxy.address, lendingPoolCoreMock.address)
  const lendingPoolMock = await deployWithWait(LendingPoolMockFactory, lendingPoolCoreMock.address, aTokenMock.address)
  const uniswapFactory = await deployWithWait(UniswapFactoryFactory)
  const uniswapTemplate = await deployWithWait(UniswapExchangeFactory)
  await txWait(uniswapFactory.initializeFactory(uniswapTemplate.address))

  return deployWithExisting(accountPrivateKey, {
    trueUsd: trueUSDProxy.address,
    registry: registryProxy.address,
    aaveLendingPool: lendingPoolMock.address,
    aTUSD: aTokenMock.address,
    uniswapFactory: uniswapFactory.address,
  }, provider)
}

if (require.main === module) {
  const rpc = process.argv[3] || rpcOptions.development
  const provider = new ethers.providers.JsonRpcProvider(rpc)
  deploy(process.argv[2], provider)
    .then(saveDeployResult(`testnet-${Date.now()}`))
    .catch(console.error)
}
