/**
 * ts-node scripts/deploy_truefi.ts "{private_key}" "{network}"
 */

/* eslint-disable */
import { ethers, providers } from 'ethers'
import { Contract } from '@ethersproject/contracts'

import { ask } from './utils'
import { asProxy } from './utils/asProxy'
// import { exchangeABI } from './abi/uniswapExchange'
// import { factoryABI } from './abi/uniswapFactory'

import {
  TrueFarmFactory,
  LinearTrueDistributorFactory,
  OwnedUpgradeabilityProxyFactory,
  TrustTokenFactory,
  // TrueUsdFactory,
  MockTrueCurrencyFactory,
  MockTrustTokenFactory,
  TokenFaucetFactory
} from '../build/types'

// default txn args
const txnArgs = { gasLimit: 2_500_000, gasPrice: 1_000_000_000 }

const zeroAddress = '0x0000000000000000000000000000000000000000'

// token addresses
let truAddress: string
let tusdAddress: string

// distribution config
let distributionStart: number
let uniswapTfiLength = 365 * 24 * 60 * 60
let uniswapEthLength = 120 * 24 * 60 * 60
let balancerLength = 30 * 24 * 60 * 60
let uniswapTfiAmount = 84_825_000 * 10**8
let uniswapEthAmount = 42_412_500 * 10**8
let balancerAmount = 11_310_000 * 10**8

// mainnet uniswap addresses
let uniswapEthTruAddress: string
let uniswapTusdTfiAddress: string
let uniswapBalTruAddress: string

// mainnet config
let mainnet = {
  truAddress: '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784',
  tusdAddress: '0x0000000000085d4780B73119b644AE5ecd22b376'
}

// ropsten config
let testnet = {
  truAddress: '0x711161baf6fa362fa41f80ad2295f1f601b44f3f',
  tusdAddress: '0x1cB0906955623920c86A3963593a02a405Bb97fC',
  controllerAddress: '0x2B5a25Fe01E96d0023764d9331228B9CB25e0089',
  uniswapFactoryAddress: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
}

async function deploy () {
  let provider
  const network = process.argv[3]
  if (network == 'local') {
    provider = new ethers.providers.JsonRpcProvider('HTTP://127.0.0.1:7545')
  }
  else {
    provider = new providers.InfuraProvider(network, 'e33335b99d78415b82f8b9bc5fdc44c0')
  }
  
  const wallet = new ethers.Wallet(process.argv[2], provider)

  let currentBlock = await provider.getBlockNumber()
  console.log('Current block ', currentBlock)
  
  if (network == 'local') {
    const[tru, tusd] = await deployTestTokens(wallet, provider)
  }

  if (network != 'mainnet') {
    const tru = await TrustTokenFactory.connect(testnet.truAddress, wallet)
    const tusd = await TrustTokenFactory.connect(testnet.tusdAddress, wallet)
    //const factoryContract = new Contract(testnet.uniswapFactoryAddress, factoryABI, wallet)
    distributionStart = currentBlock

    await deployFarms(wallet, provider, tru)
  }

  console.log('TrueFi Deployment Completed')
}

async function deployLending (wallet, provider, tru, tusd) {

}

async function deployRopstenMockUniswaps(wallet, provider, tru, tusd) {

}

async function deployFarms (wallet, provider, tru) {
  // deploy distributor implementations
  const uniswapTfiDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapTfiDistributorImpl', uniswapTfiDistributorImpl.address)
  
  const uniswapEthDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapEthDistributorImpl', uniswapEthDistributorImpl.address)
  
  const balancerDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('balancerDistributorImpl', balancerDistributorImpl.address)

  // put distributors behind proxy
  const uniswapTfiDistributor = await behindProxy(wallet, uniswapTfiDistributorImpl, txnArgs.gasPrice)
  console.log('uniswapTfiDistributor', uniswapTfiDistributor.address)

  const uniswapEthDistributor = await behindProxy(wallet, uniswapEthDistributorImpl, txnArgs.gasPrice)
  console.log('uniswapEthDistributor', uniswapEthDistributor.address)

  const balancerDistributor = await behindProxy(wallet, balancerDistributorImpl, txnArgs.gasPrice)
  console.log('balancerDistributorProxy', balancerDistributor.address)
    
  // deploy farm implemention
  const uniswapTfiFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapTfiFarmImpl', uniswapTfiFarmImpl.address)

  const uniswapEthFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapEthFarmImpl', uniswapEthFarmImpl.address)

  const balancerFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('balancerFarmImpl', balancerFarmImpl.address)

  // Put Distributors behind proxy
  const uniswapTfiFarm = await behindProxy(wallet, uniswapTfiFarmImpl, txnArgs.gasPrice)
  console.log('uniswapTfiFarm', uniswapTfiFarm.address)

  const uniswapEthFarm = await behindProxy(wallet, uniswapEthFarmImpl, txnArgs.gasPrice)
  console.log('uniswapEthFarm', uniswapEthFarm.address)

  const balancerFarm = await behindProxy(wallet, balancerFarmImpl, txnArgs.gasPrice)
  console.log('balancerFarmProxy', balancerFarm.address)

  // init distributors
  await uniswapTfiDistributor.initialize(distributionStart, uniswapTfiLength, uniswapTfiAmount, tru.address)
  console.log('init uniswapTfiDistributor')
  await uniswapEthDistributor.initialize(distributionStart, uniswapEthLength, uniswapEthAmount, tru.address)
  console.log('init uniswapEthDistributor')
  await balancerDistributor.initialize(distributionStart, balancerLength, balancerAmount, tru.address)
  console.log('init balancerDistributor')

  // Transfer TRU to Distributors (assumes wallet has enough TRU)
  await (await tru.transfer(uniswapTfiFarm.address, uniswapTfiAmount, txnArgs)).wait()
  console.log('transferred', uniswapTfiAmount, 'to', 'uniswapTfiFarm')
  
  await (await tru.transfer(uniswapEthFarm.address, uniswapEthAmount, txnArgs)).wait()
  console.log('transferred', uniswapEthAmount, 'to', 'uniswapEthFarm')
  
  await (await tru.transfer(balancerFarm.address, balancerAmount, txnArgs)).wait()
  console.log('transferred', balancerAmount, 'to', 'balancerFarm')
}

async function deployMockTrustToken() {

}

async function behindProxy(wallet: ethers.Wallet, implementation: Contract, gasPrice: number) {
  const proxyTxnArgs = { gasLimit: 2_500_000, gasPrice: gasPrice }
  const upgradeTxnArgs = { gasLimit: 200_000, gasPrice: gasPrice }
  const proxy = await (await new OwnedUpgradeabilityProxyFactory(wallet).deploy(proxyTxnArgs)).deployed()
  await proxy.upgradeTo(implementation.address, upgradeTxnArgs)
  const contract = implementation.attach(proxy.address).connect(wallet)
  return contract
}

async function initDistributor(
  wallet: ethers.Wallet,
  startBlock: number,
  endBlock: number,
  amount: number,
  tru: ethers.Contract )
{
  let txnArgs = { gasLimit: 2_500_000, gasPrice: 1_000_000_000 }

}

async function deployTestTokens(wallet, provider) {
  const testArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }
  // deploy implementations
  const truImpl = await (await new MockTrustTokenFactory(wallet).deploy(testArgs)).deployed()
  console.log('truImpl', truImpl.address)

  const tusdImpl = await (await new MockTrueCurrencyFactory(wallet).deploy(testArgs)).deployed()
  console.log('tusdImpl', tusdImpl.address)

  const controllerImpl = await (await new TokenFaucetFactory(wallet).deploy(testArgs)).deployed()
  console.log('tusdImpl', tusdImpl.address)

  // put contracts behind proxies
  const tru = await behindProxy(wallet, truImpl, testArgs.gasPrice)
  console.log('tru', tru.address)

  const tusd = await behindProxy(wallet, tusdImpl, testArgs.gasPrice)
  console.log('tusd', tusd.address)

  const controller = await behindProxy(wallet, controllerImpl, testArgs.gasPrice)
  console.log('controller', controller.address)

  // init contracts
  await tru.initialize(testArgs)
  console.log('init tru')
  await tusd.initialize(testArgs)
  console.log('init tusd')
  await controller.initializeWithParams(tusd.address, zeroAddress, testArgs)
  console.log('init controller')
  await tusd.transferOwnership(controller.address, testArgs)
  console.log('transfer tusd')
  await controller.issueClaimOwnership(tusd.address, testArgs)
  console.log('claim tusd')
  await tru.ownerFaucet(wallet.address, '100000000000000000', testArgs) // mint 1 billion tru
  console.log('minted tru')
  await controller.faucet('1000000000000000000000000', testArgs) // mint 1 billion tru
  console.log('minted tusd')

  return [tru, tusd]
}

deploy().catch(console.error)
