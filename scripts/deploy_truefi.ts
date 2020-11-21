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
import deployment from './deploy/truefi.json'
const mainnet = deployment.mainnet
const ropsten = deployment.ropsten

import {
  TrueFarmFactory,
  LinearTrueDistributorFactory,
  ArbitraryDistributorFactory,
  OwnedUpgradeabilityProxyFactory,
  LoanFactoryFactory,
  TrustTokenFactory,
  TrueUsdFactory,
  TrueFiPoolFactory,
  TrueLenderFactory,
  TrueRatingAgencyFactory,
  MockTrueCurrencyFactory,
  MockTrustTokenFactory,
  TokenFaucetFactory,
  MockErc20TokenFactory,
  MockCurvePoolFactory,
  MockCurveGaugeFactory,
  MockErc20Factory,
} from '../build/types'

import {
  ICurveGaugeJson,
  IERC20Json
} from '../build'

// default txn args
const txnArgs = { gasLimit: 2_000_000, gasPrice: 40_000_000_000 }

const zeroAddress = '0x0000000000000000000000000000000000000000'

// token addresses
let truAddress: string
let tusdAddress: string

// distribution config
let distributionStart: BigNumber
let uniswapTfiLength = BigNumber.from(180 * 24 * 60 * 60)
let uniswapEthLength = BigNumber.from(120 * 24 * 60 * 60)
let balancerLength = BigNumber.from(30 * 24 * 60 * 60)
let tfiLength = BigNumber.from(1140 * 24 * 60 * 60)

let uniswapTfiAmount = BigNumber.from(39_585_000).mul(BigNumber.from(10**8))
let uniswapEthAmount = BigNumber.from(62_205_000).mul(BigNumber.from(10**8))
let balancerAmount = BigNumber.from(11_310_000).mul(BigNumber.from(10**8))
let creditMarketAmount = BigNumber.from(254_475_000).mul(BigNumber.from(10**8))
let tfiAmount = BigNumber.from(195_097_500).mul(BigNumber.from(10**8))

// mainnet uniswap addresses
let uniswapEthTruAddress: string
let uniswapTusdTfiAddress: string
let uniswapBalTruAddress: string

let uniswapFactoryAddress: string
let balancerFactoryAddress: string

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

  let blockNumber = await provider.getBlockNumber()
  console.log('Current block ', blockNumber)
  let timestamp = (await provider.getBlock(blockNumber)).timestamp
  console.log('Current timestamp ', timestamp)
  
  // fresh deploy for local testing
  if (network == 'local') {
    distributionStart = timestamp
    const weth = await deployWeth(wallet, provider)
    const [tru, tusd] = await deployTestTokens(wallet, provider)
    const uniswap = await deployUniswap(wallet, provider)
    const [curve, crv, curveGauge] = await deployCurve(wallet, provider, tusd)
    const bal = await deployMockBalToken(wallet, provider)
    const balancer = await deployBalancer(wallet, provider)
    const balancerBalTru = await deployMockBalancerPair(wallet, provider)
    const [tfi, lender, creditMarket] = await deployTrueFi(wallet, provider, tru, tusd, curve, curveGauge, uniswap)
    const [uniswapEthTru, uniswapTusdTfi] = await deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth)
    const [tfiFarm, uniswapTfiFarm, uniswapEthFarm, balancerFarm] = await deployFarms(
      wallet, provider, tru, tfi, uniswapEthTru, uniswapTusdTfi, balancerBalTru)
  }

  // ropsten deploy
  if (network == 'mainnet') {
    distributionStart = BigNumber.from(1605977911)
    const tru = await TrustTokenFactory.connect(ropsten.tru, wallet)
    const tusd = await MockTrueCurrencyFactory.connect(ropsten.tusd, wallet)
    const weth = await new Contract(ropsten.weth, IERC20Json.abi, wallet)
    const uniswap = await new Contract(ropsten.uniswap, UniswapV2Factory.abi, wallet)
    const tfi = await TrueFiPoolFactory.connect(ropsten.tfi, wallet)
    const uniswapEthTru = await new Contract(ropsten.uniswapEthTru, IERC20Json.abi, wallet)
    const uniswapTusdTfi = await new Contract(ropsten.uniswapTusdTfi, IERC20Json.abi, wallet)
    const balancerBalTru = await new Contract(ropsten.balancerBalTru, IERC20Json.abi, wallet)
    // const bal = await TrustTokenFactory.connect(ropsten.tru, wallet)
    // const [tfiFarm, uniswapTfiFarm, uniswapEthFarm, balancerFarm] = await deployFarms(
    //   wallet, provider, tru, tfi, uniswapEthTru, uniswapTusdTfi, balancerBalTru)
    // const curve = MockCurvePoolFactory.connect(ropsten.curve, wallet)
    // const crv = MockErc20TokenFactory.connect(ropsten.crv, wallet)
    // const curveGauge = MockCurveGaugeFactory.connect(ropsten.curveGauge, wallet)
    // const [curve, crv, curveGauge] = await deployCurve(wallet, provider, tusd)
    // const balancer = deployBalancer(wallet, provider)
    // const [tfi, lender, creditMarket] = await deployTrueFi(wallet, provider, tru, tusd, curve, curveGauge, uniswap)
    // const [uniswapEthTru, uniswapTusdTfi] = await deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth)
    // const [uniswapTfiFarm, uniswapEthFarm, balancerFarm] = await deployFarms(wallet, provider, tru)
  }

  // mainnet deploy
  if (network == 'ropsten') {
    const tru = await TrustTokenFactory.connect(mainnet.tru, wallet)
    const tusd = await TrueUsdFactory.connect(mainnet.tusd, wallet)
    const weth = {address: mainnet.weth}
    const uniswapRouter = {address: mainnet.uniswapRouter}
    const curve = {address: mainnet.curve}
    const curveGauge = {address: mainnet.curveGauge}
    const lender = await TrueLenderFactory.connect(mainnet.lender, wallet)
    const creditMarket = TrueRatingAgencyFactory.connect(mainnet.creditMarket, wallet)
    const tfi = await TrueFiPoolFactory.connect(mainnet.tfi, wallet)
    const loanFactory = await LoanFactoryFactory.connect(mainnet.loanFactory, wallet)
    const uniswapEthTru = { address: mainnet.uniswapEthTru }
    const uniswapTusdTfi = { address: mainnet.uniswapTusdTfi }
    const balancerBalTru = { address: mainnet.balancerBalTru }
    const [tfiFarm, uniswapTfiFarm, uniswapEthTruFarm, balancerBalTruFarm] = await deployFarms(wallet, provider, tru, tfi, uniswapTusdTfi, uniswapEthTru, balancerBalTru)
    // await initTrueFi(wallet, provider, tfi, tusd, lender, creditMarket, uniswapRouter, curve, curveGauge)
    // const [tfi, lender, creditMarket] = await deployTrueFi(wallet, provider, tru, tusd, curve, curveGauge, uniswapRouter)
  }

  console.log('\nTrueFi Deployment Completed')
}

async function initTrueFi(wallet, provider, tfi, tusd, lender, creditMarket, uniswapRouter, curve, curveGauge) {
  await wait(tfi.initialize(curve.address, curveGauge.address, tusd.address, lender.address, uniswapRouter.address, txnArgs))
  console.log("init tfi")

  await wait(lender.initialize(tfi.address, creditMarket.address, txnArgs))
  console.log("init lender")
}

async function deployTrueFi (wallet, provider, tru, tusd, curve, curveGauge, uniswapRouter) {
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

  // deploy behing proxies
  const loanFactory = await behindProxy(wallet, loanFactoryImpl)
  console.log('loanFactory', loanFactory.address)

  const creditMarket = await behindProxy(wallet, creditMarketImpl)
  console.log('creditMarket', creditMarket.address)

  const lender = await behindProxy(wallet, lenderImpl)
  console.log('lender', lender.address)

  const tfi = await behindProxy(wallet, tfiImpl)
  console.log('tfi', tfi.address)

  const creditMarketDistributorImpl = await (await new ArbitraryDistributorFactory(wallet).deploy(deployArgs)).deployed()
  console.log('creditMarketDistributorImpl', creditMarketDistributorImpl.address)

  const creditMarketDistributor = await behindProxy(wallet, creditMarketDistributorImpl)
  console.log('creditMarketDistributor', creditMarketDistributor.address)

  // initalize contracts
  await wait(creditMarketDistributor.initialize(creditMarket.address, tru.address, creditMarketAmount.toString(), txnArgs))
  console.log("init creditMarketDistributor")

  await wait(loanFactory.initialize(tusd.address, txnArgs))
  console.log("init loanFactory")

  await wait(creditMarket.initialize(tru.address, creditMarketDistributor.address, loanFactory.address, txnArgs))
  console.log("init creditMarket")

  await wait(tfi.initialize(curve.address, curveGauge.address, tusd.address, lender.address, uniswapRouter.address, txnArgs))
  console.log("init tfi")

  await wait(lender.initialize(tfi.address, creditMarket.address, txnArgs))
  console.log("init lender")

  // Transfer TRU to Distributors (assumes wallet has enough TRU)
  // await wait(tru.transfer(creditMarketDistributor.address, creditMarketAmount, txnArgs))
  // console.log('transferred', creditMarketAmount.toString(), 'to', 'creditMarketDistributor')

  return [tfi, lender, creditMarket]
}

async function deployUniswapPairs(wallet, provider, uniswap, tru, tusd, tfi, weth) {
  // const pairArgs = {gasLimit: 4_000_000, gasPrice: txnArgs.gasPrice}
  // const uniswapEthTru = await wait(uniswap.createPair(weth.address, tru.address, pairArgs))
  // const uniswapTusdTfi = await wait(uniswap.createPair(tusd.address, tfi.address, pairArgs))
  const uniswapEthTru = await(await new MockErc20Factory(wallet).deploy("ETH/TRU", "Uniswap Bal/TRU", txnArgs)).deployed()
  const uniswapTusdTfi = await(await new MockErc20Factory(wallet).deploy("TUSD/TFI", "Uniswap TUSD/TFI", txnArgs)).deployed()

  console.log('uniswap TRU/ETH', uniswapEthTru.address)
  console.log('uniswap TUSD/TFI', uniswapTusdTfi.address)
  return [uniswapEthTru, uniswapTusdTfi]
}

async function deployBalancer(wallet, provider) {
  console.log("deployed balancer: ", zeroAddress)
  return {address: zeroAddress}
}

async function deployMockBalancerPair(wallet, provider) {
    const balancerbalTru = await(await new MockErc20Factory(wallet).deploy("BAL/TRU", "Balancer Bal/TRU", txnArgs)).deployed()
    return balancerbalTru
}

// mock curve
async function deployCurve(wallet, provider, tusd) {
  const curve = await(await new MockCurvePoolFactory(wallet).deploy()).deployed()
  await curve.initialize(tusd.address)
  const crv = await(await new MockErc20Factory(wallet).deploy("CRV", "CRV", txnArgs)).deployed()
  const curveGauge = await(await new MockCurveGaugeFactory(wallet).deploy()).deployed()
  console.log("crv", crv.address)  
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

async function deployFarm(
  wallet, 
  provider, 
  tru,
  lpToken,
  name : string,
  amount: BigNumber,
  start: BigNumber,
  length: BigNumber
) {
  console.log('\nDeploying', name)
  console.log('amount', amount.toString())
  console.log('start', start.toString())
  console.log('length', length.toString())
  console.log('\n')

  const deployArgs = {gasLimit: 3_500_000, gasPrice: txnArgs.gasPrice}

  // deploy distributor implementation
  const distributorImpl = await (await new LinearTrueDistributorFactory(wallet).deploy(deployArgs)).deployed()
  console.log(name, 'distributorImpl', distributorImpl.address)

  // put distributor behind proxy
  const distributor = await behindProxy(wallet, distributorImpl)
  console.log(name, 'distributor', distributor.address)

  // deploy farm implemention
  const farmImpl = await (await new TrueFarmFactory(wallet).deploy(deployArgs)).deployed()
  console.log(name, 'farmImpl', farmImpl.address)

  // put farm behind proxy
  const farm = await behindProxy(wallet, farmImpl)
  console.log(name, 'farm', farm.address)

  // transfer tru to distributor (assumes wallet has enough tru)
  /*
  await wait(tru.transfer(farm.address, uniswapTfiAmount, txnArgs))
  console.log('transferred', amount.toString(), 'to', name, 'distributor')
  */

  // init distributor
  await wait(distributor.initialize(start.toString(), length.toString(), amount.toString(), tru.address, txnArgs))
  console.log('init', name, 'distributor')

  // set farm
  await wait(distributor.setFarm(farm.address, txnArgs));
  console.log('set farm')

  // init farm
  await wait(farm.initialize(lpToken.address, distributor.address, name, txnArgs))
  console.log('init', name, 'farm')

  return farm
}

// farms
async function deployFarms (
  wallet,
  provider,
  tru,
  tfi,
  uniswapTusdTfi,
  uniswapEthTru,
  balancerBalTru
) {
  const tfiFarm = await deployFarm(
    wallet, provider, tru, tfi, "TFI-LP", 
    tfiAmount, distributionStart, tfiLength
  )

  const uniswapTfiFarm = await deployFarm(
    wallet, provider, tru, uniswapTusdTfi, "Uniswap TUSD/TFI-LP", 
    uniswapTfiAmount, distributionStart, uniswapTfiLength
  )

  const uniswapEthTruFarm = await deployFarm(
    wallet, provider, tru, uniswapEthTru, "Uniswap ETH/TRU", 
    uniswapEthAmount, distributionStart, uniswapEthLength
  )

  const balancerBalTruFarm = await deployFarm(
    wallet, provider, tru, balancerBalTru, "Balancer BAL/TRU", 
    balancerAmount, distributionStart, balancerLength
  )

  return [tfiFarm, uniswapTfiFarm, uniswapEthTruFarm, balancerBalTruFarm]
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

async function deployMockBalToken(wallet, provider) {
  const testArgs = { gasLimit: 4_500_000, gasPrice: 1_000_000_000 }

  const bal = await(await new MockErc20Factory(wallet).deploy("BAL", "BAL", testArgs)).deployed()
  console.log("bal", bal.address)
  return bal
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
