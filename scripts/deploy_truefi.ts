/* eslint-disable */

/**
 * ts-node scripts/deploy_truefi.ts "{private_key}" "{network}"
 */
import { ethers, providers, BigNumber } from 'ethers'
import { Contract, ContractFactory } from '@ethersproject/contracts'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'

import { ask } from './utils'
import { waitForTx } from 'scripts/utils/waitForTx'
import { asProxy } from './utils/asProxy'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
// import { wethAbi } from './abi/weth'

import {
  TrueFarmFactory,
  LinearTrueDistributorFactory,
  ArbitraryDistributorFactory,
  OwnedUpgradeabilityProxyFactory,
  LoanFactoryFactory,
  TrustTokenFactory,
  TrueFiPoolFactory,
  TrueLenderFactory,
  TrueRatingAgencyFactory,
  MockTrueCurrencyFactory,
  MockTrustTokenFactory,
  TokenFaucetFactory,
  MockErc20TokenFactory,
  MockCurvePoolFactory,
  MockCurveGaugeFactory,
} from '../build/types'

import {
  ICurveGaugeJson,
} from '../build'

// default txn args
const txnArgs = { gasLimit: 2_500_000, gasPrice: 0_001_000_000 }

const zeroAddress = '0x0000000000000000000000000000000000000000'

// token addresses
let truAddress: string
let tusdAddress: string

// distribution config
let distributionStart: number
let uniswapTfiLength = BigNumber.from(365 * 24 * 60 * 60)
let uniswapEthLength = BigNumber.from(120 * 24 * 60 * 60)
let balancerLength = BigNumber.from(30 * 24 * 60 * 60)
let tfiLength = BigNumber.from(1140 * 24 * 60 * 60)
let uniswapTfiAmount = BigNumber.from(84_825_000).mul(BigNumber.from(10**8))
let uniswapEthAmount = BigNumber.from(42_412_500).mul(BigNumber.from(10**8))
let balancerAmount = BigNumber.from(11_310_000).mul(BigNumber.from(10**8))
let creditMarketAmount = BigNumber.from(254_475_000).mul(BigNumber.from(10**8))
let tfiAmount = BigNumber.from(169_650_000).mul(BigNumber.from(10**8))

// mainnet uniswap addresses
let uniswapEthTruAddress: string
let uniswapTusdTfiAddress: string
let uniswapBalTruAddress: string

let uniswapFactoryAddress: string
let balancerFactoryAddress: string

// mainnet config
let mainnet = {
  truAddress: '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784',
  tusdAddress: '0x0000000000085d4780B73119b644AE5ecd22b376',
  balancerFactoryAddress: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
  wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  uniswapFactoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  curve: '0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3',
  curveGauge: '0x0001FB050Fe7312791bF6475b96569D83F695C9f',
  crv: '0xD533a949740bb3306d119CC777fa900bA034cd52'
}

// ropsten config
let testnet = {
  truAddress: '0x12b2f909d9ea91c86dc7fbba272d8abbcddfd72c',
  tusdAddress: '0x1cB0906955623920c86A3963593a02a405Bb97fC',
  controllerAddress: '0x2B5a25Fe01E96d0023764d9331228B9CB25e0089',
  uniswapFactoryAddress: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
  wethAddress: '0xb603cEa165119701B58D56d10D2060fBFB3efad8'
}

export const wait = async <T>(tx: Promise<{wait: () => Promise<T>}>): Promise<T> => (await tx).wait()

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
  
  // fresh deploy for local testing
  if (network == 'local') {
    distributionStart = currentBlock
    const weth = await deployWeth(wallet, provider)
    const [tru, tusd] = await deployTestTokens(wallet, provider)
    const uniswap = await deployUniswap(wallet, provider)
    const [curve, crv, curveGauge] = await deployCurve(wallet, provider, tusd)
    const balancer = deployBalancer(wallet, provider)
    const [tfi, lender, creditMarket] = await deployTrueFi(wallet, provider, tru, tusd, curve, curveGauge, uniswap)
    const [uniswapTruEth, uniswapTusdTfi] = await deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth)
    const [uniswapTfiFarm, uniswapEthFarm, balancerFarm] = await deployFarms(wallet, provider, tru)
  }

  // ropsten deploy
  if (network == 'ropsten') {
    distributionStart = currentBlock
    const tru = await TrustTokenFactory.connect(testnet.truAddress, wallet)
    const tusd = await MockTrueCurrencyFactory.connect(testnet.tusdAddress, wallet)
    const weth = await MockErc20TokenFactory.connect(testnet.wethAddress, wallet)
    const uniswap = await new Contract(testnet.uniswapFactoryAddress, UniswapV2Factory.abi, wallet)
    const [curve, crv, curveGauge] = await deployCurve(wallet, provider, tusd)
    const balancer = deployBalancer(wallet, provider)
    const [tfi, lender, creditMarket] = await deployTrueFi(wallet, provider, tru, tusd, curve, curveGauge, uniswap)
    const [uniswapTruEth, uniswapTusdTfi] = await deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth)
    const [uniswapTfiFarm, uniswapEthFarm, balancerFarm] = await deployFarms(wallet, provider, tru)
  }

  // mainnet deploy
  if (network == 'mainnet') {
    const tru = await TrustTokenFactory.connect(mainnet.truAddress, wallet)
    const tusd = await MockTrueCurrencyFactory.connect(mainnet.tusdAddress, wallet)
    const weth = await MockErc20TokenFactory.connect(mainnet.wethAddress, wallet)
    const uniswap = await new Contract(mainnet.uniswapFactoryAddress, UniswapV2Factory.abi, wallet)
  }

  console.log('\nTrueFi Deployment Completed')
}

async function deployTrueFi (wallet, provider, tru, tusd, curve, curveGauge, uniswap) {
  const deployArgs = {gasLimit: 4_000_000, gasPrice: txnArgs.gasPrice}

  // deploy implementations
  const loanFactoryImpl = await (await new LoanFactoryFactory(wallet).deploy(deployArgs)).deployed()
  console.log('loanFactoryImpl', loanFactoryImpl.address)

  const creditMarketImpl = await (await new TrueRatingAgencyFactory(wallet).deploy(deployArgs)).deployed()
  console.log('creditMarketImpl', creditMarketImpl.address)

  const lenderImpl = await (await new TrueLenderFactory(wallet).deploy(deployArgs)).deployed()
  console.log('lenderImpl', lenderImpl.address)

  const tfiImpl = await (await new TrueFiPoolFactory(wallet).deploy(deployArgs)).deployed()
  console.log('tfiImpl', tfiImpl.address)

  const creditMarketDistributorImpl = await (await new ArbitraryDistributorFactory(wallet).deploy(deployArgs)).deployed()
  console.log('creditMarketDistributorImpl', creditMarketDistributorImpl.address)

  const tfiDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(deployArgs)).deployed()
  console.log('tfiDistributorImpl', tfiDistributorImpl.address)

  // deploy behing proxies
  const loanFactory = await behindProxy(wallet, loanFactoryImpl)
  console.log('loanFactory', loanFactory.address)

  const creditMarket = await behindProxy(wallet, creditMarketImpl)
  console.log('creditMarket', creditMarket.address)

  const lender = await behindProxy(wallet, lenderImpl)
  console.log('lender', lender.address)

  const tfi = await behindProxy(wallet, tfiImpl)
  console.log('tfi', tfi.address)

  const creditMarketDistributor = await behindProxy(wallet, creditMarketDistributorImpl)
  console.log('creditMarketDistributor', creditMarketDistributor.address)

  const tfiDistributor = await behindProxy(wallet, tfiDistributorImpl)
  console.log('tfiDistributor', tfiDistributor.address)

  // initalize contracts
  await wait(creditMarketDistributor.initialize(creditMarket.address, tru.address, creditMarketAmount))
  console.log("init creditMarketDistributor")

  // start length amount address
  await wait(tfiDistributor.initialize(distributionStart, tfiLength, tfiAmount, tru.address))
  console.log("init tfiDistributor")

  await wait(loanFactory.initialize(tusd.address))
  console.log("init loanFactory")

  await wait(creditMarket.initialize(tru.address, creditMarketDistributor.address, loanFactory.address, txnArgs))
  console.log("init creditMarket")

  await wait(tfi.initialize(curve.address, curveGauge.address, tusd.address, lender.address, zeroAddress, txnArgs))
  console.log("init tfi")

  await wait(lender.initialize(tfi.address, creditMarket.address, txnArgs))
  console.log("init lender")

  // Transfer TRU to Distributors (assumes wallet has enough TRU)
  await wait(tru.transfer(creditMarketDistributor.address, creditMarketAmount, txnArgs))
  console.log('transferred', creditMarketAmount.toString(), 'to', 'creditMarketDistributor')
  
  await wait(tru.transfer(tfiDistributor.address, tfiAmount, txnArgs))
  console.log('transferred', tfiAmount.toString(), 'to', 'tfiDistributor')

  return [tfi, lender, creditMarket]
}

async function deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth) {
  const pairArgs = {gasLimit: 4_000_000, gasPrice: txnArgs.gasPrice}
  const uniswapTruEth = await wait(uniswap.createPair(weth.address, tru.address, pairArgs))
  const uniswapTusdTfi = await wait(uniswap.createPair(tusd.address, tfi.address, pairArgs))
  console.log('uniswap TRU/ETH', uniswapTruEth)
  console.log('uniswap TUSD/TFI', uniswapTusdTfi)
  return [uniswapTruEth, uniswapTusdTfi]
}

async function deployBalancer(wallet, provider) {
  return {address: zeroAddress}
}

// mock curve
async function deployCurve(wallet, provider, tusd) {
  const curve = await(await new MockCurvePoolFactory(wallet).deploy()).deployed()
  await curve.initialize(tusd.address)
  const crv = MockErc20TokenFactory.connect(await curve.token(), wallet)
  const curveGauge = await(await new MockCurveGaugeFactory(wallet).deploy()).deployed()
  console.log('MockCurve', curve.address)
  console.log('MockCRV', crv.address)
  console.log('mockCurveGauge', curveGauge.address)
  return [curve, crv, curveGauge]
}

// mock uniswap
async function deployUniswap(wallet, provider) {
  const deployArgs = { gasLimit: 5_000_000, gasPrice: txnArgs.gasPrice}
  const UniswapFactory = new ContractFactory(UniswapV2Factory.interface, UniswapV2Factory.bytecode, wallet)
  const uniswap = await (await UniswapFactory.deploy(wallet.address, deployArgs)).deployed()
  console.log('uniswap', uniswap.address)
  return uniswap
}

// mock Weth
async function deployWeth(wallet, provider) {
  const weth = await (await new MockErc20TokenFactory(wallet).deploy(txnArgs)).deployed()
  console.log('weth', weth.address)
  return weth
}

// farms
async function deployFarms (wallet, provider, tru) {
  // deploy distributor implementations
  const uniswapTfiDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapTfiDistributorImpl', uniswapTfiDistributorImpl.address)
  
  const uniswapEthDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapEthDistributorImpl', uniswapEthDistributorImpl.address)
  
  const balancerDistributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(txnArgs)).deployed()
  console.log('balancerDistributorImpl', balancerDistributorImpl.address)

  // put distributors behind proxy
  const uniswapTfiDistributor = await behindProxy(wallet, uniswapTfiDistributorImpl)
  console.log('uniswapTfiDistributor', uniswapTfiDistributor.address)

  const uniswapEthDistributor = await behindProxy(wallet, uniswapEthDistributorImpl)
  console.log('uniswapEthDistributor', uniswapEthDistributor.address)

  const balancerDistributor = await behindProxy(wallet, balancerDistributorImpl)
  console.log('balancerDistributorProxy', balancerDistributor.address)
    
  // deploy farm implemention
  const uniswapTfiFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapTfiFarmImpl', uniswapTfiFarmImpl.address)

  const uniswapEthFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('uniswapEthFarmImpl', uniswapEthFarmImpl.address)

  const balancerFarmImpl = await (await new TrueFarmFactory(wallet).deploy(txnArgs)).deployed()
  console.log('balancerFarmImpl', balancerFarmImpl.address)

  // Put Distributors behind proxy
  const uniswapTfiFarm = await behindProxy(wallet, uniswapTfiFarmImpl)
  console.log('uniswapTfiFarm', uniswapTfiFarm.address)

  const uniswapEthFarm = await behindProxy(wallet, uniswapEthFarmImpl)
  console.log('uniswapEthFarm', uniswapEthFarm.address)

  const balancerFarm = await behindProxy(wallet, balancerFarmImpl)
  console.log('balancerFarmProxy', balancerFarm.address)

  // init distributors
  await wait (uniswapTfiDistributor.initialize(distributionStart, uniswapTfiLength, uniswapTfiAmount, tru.address))
  console.log('init uniswapTfiDistributor')
  await wait (uniswapEthDistributor.initialize(distributionStart, uniswapEthLength, uniswapEthAmount, tru.address))
  console.log('init uniswapEthDistributor')
  await wait (balancerDistributor.initialize(distributionStart, balancerLength, balancerAmount, tru.address))
  console.log('init balancerDistributor')

  // Transfer TRU to Distributors (assumes wallet has enough TRU)
  await wait(tru.transfer(uniswapTfiFarm.address, uniswapTfiAmount, txnArgs))
  console.log('transferred', uniswapTfiAmount.toString(), 'to', 'uniswapTfiDistributor')
  
  await wait(tru.transfer(uniswapEthFarm.address, uniswapEthAmount, txnArgs))
  console.log('transferred', uniswapEthAmount.toString(), 'to', 'uniswapEthDistributor')
  
  await wait(tru.transfer(balancerFarm.address, balancerAmount, txnArgs))
  console.log('transferred', balancerAmount.toString(), 'to', 'balancerDistributor')
  return [uniswapTfiFarm, uniswapEthFarm, balancerFarm]
}

// deploy contract implementation behind proxy
async function behindProxy(wallet: ethers.Wallet, implementation: Contract) {
  const proxyTxnArgs = { gasLimit: 2_500_000, gasPrice: txnArgs.gasPrice }
  const upgradeTxnArgs = { gasLimit: 200_000, gasPrice: txnArgs.gasPrice }
  const proxy = await (await new OwnedUpgradeabilityProxyFactory(wallet).deploy(proxyTxnArgs)).deployed()
  await wait(proxy.upgradeTo(implementation.address, upgradeTxnArgs))
  const contract = implementation.attach(proxy.address).connect(wallet)
  return contract
}

// used for local network testing
async function deployTestTokens(wallet, provider) {
  const testArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }

  // deploy implementations
  const truImpl = await (await new MockTrustTokenFactory(wallet).deploy(testArgs)).deployed()
  console.log('truImpl', truImpl.address)

  const tusdImpl = await (await new MockTrueCurrencyFactory(wallet).deploy(testArgs)).deployed()
  console.log('tusdImpl', tusdImpl.address)

  const controllerImpl = await (await new TokenFaucetFactory(wallet).deploy(testArgs)).deployed()
  console.log('controllerImpl', tusdImpl.address)

  // put contracts behind proxies
  const tru = await behindProxy(wallet, truImpl)
  console.log('tru', tru.address)

  const tusd = await behindProxy(wallet, tusdImpl)
  console.log('tusd', tusd.address)

  const controller = await behindProxy(wallet, controllerImpl)
  console.log('controller', controller.address)

  // init contracts
  await wait(tru.initialize(testArgs))
  console.log('init tru')
  await wait(tusd.initialize(testArgs))
  console.log('init tusd')
  await wait(controller.initializeWithParams(tusd.address, zeroAddress, testArgs))
  console.log('init controller')
  await wait(tusd.transferOwnership(controller.address, testArgs))
  console.log('transfer tusd')
  await wait(controller.issueClaimOwnership(tusd.address, testArgs))
  console.log('claim tusd')
  await wait(tru.ownerFaucet(wallet.address, '100000000000000000', testArgs)) // mint 1 billion tru
  console.log('minted tru')
  await wait(controller.faucet('1000000000000000000000000', testArgs)) // mint 1 billion tru
  console.log('minted tusd')

  return [tru, tusd]
}

deploy().catch(console.error)
