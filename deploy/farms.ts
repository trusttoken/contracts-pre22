import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import { utils, BigNumber } from 'ethers'

import {
  OwnedUpgradeabilityProxy,
  LinearTrueDistributor,
  SushiTimelock,
  TestTrustToken,
  TrueFarm,
  TrueFiPool,
  TrueMultiFarm,
  TruSushiswapRewarder,
  StkTruToken,
} from '../build/artifacts'
import {
  TRU, TRU_DECIMALS, SUSHI_MASTER_CHEF, SUSHI_REWARD_MULTIPLIER
} from './config.json'

const DAY = 60 * 60 * 24
const YEAR = 365 * DAY
const TIMELOCK_DELAY = 2 * DAY

const DISTRIBUTION_DURATION = 2 * YEAR
const DISTRIBUTION_START = Math.floor(Date.now() / 1000) + DAY
const DISTRIBUTION_AMOUNT = utils.parseUnits('330000', TRU_DECIMALS).mul(2 * 365)

deploy({}, (deployer, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const TIMELOCK_ADMIN = deployer

  // Existing contracts
  const trustToken = isMainnet
    ? TRU
    : contract(TestTrustToken)
  let stkTruToken = proxy(contract(StkTruToken), () => { })
  let trueFiPool = proxy(contract(TrueFiPool), () => { })

  // New contract impls
  const trueFiPool_LinearTrueDistributor_impl = contract('trueFiPool_LinearTrueDistributor', LinearTrueDistributor)
  const trueFiPool_TrueFarm_impl = contract('trueFiPool_TrueFarm', TrueFarm)
  const trueMultiFarm_LinearTrueDistributor_impl = contract('trueMultiFarm_LinearTrueDistributor', LinearTrueDistributor)
  const trueMultiFarm_impl = contract(TrueMultiFarm)
  const truSushiswapRewarder_impl = contract(TruSushiswapRewarder)

  // New contract proxies
  const trueFiPool_LinearTrueDistributor = proxy(trueFiPool_LinearTrueDistributor_impl, () => { })
  const trueFiPool_TrueFarm = proxy(trueFiPool_TrueFarm_impl, () => { })
  const trueMultiFarm_LinearTrueDistributor = proxy(trueMultiFarm_LinearTrueDistributor_impl, () => { })
  const trueMultiFarm = proxy(trueMultiFarm_impl, () => { })
  const truSushiswapRewarder = proxy(truSushiswapRewarder_impl, () => { })

  // New bare contracts
  const sushiTimelock = contract(SushiTimelock, [TIMELOCK_ADMIN, TIMELOCK_DELAY])

  // Contract initialization
  runIf(trueFiPool_LinearTrueDistributor.isInitialized().not(), () => {
    trueFiPool_LinearTrueDistributor.initialize(DISTRIBUTION_START, DISTRIBUTION_DURATION, DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(trueFiPool_LinearTrueDistributor.farm().equals(trueFiPool_TrueFarm).not(), () => {
    trueFiPool_LinearTrueDistributor.setFarm(trueFiPool_TrueFarm)
  })
  runIf(trueFiPool_TrueFarm.isInitialized().not(), () => {
    trueFiPool_TrueFarm.initialize(trueFiPool, trueFiPool_LinearTrueDistributor, 'TrueFi tfTUSD Farm')
  })
  runIf(trueMultiFarm_LinearTrueDistributor.isInitialized().not(), () => {
    trueMultiFarm_LinearTrueDistributor.initialize(DISTRIBUTION_START, DISTRIBUTION_DURATION, DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(trueMultiFarm_LinearTrueDistributor.farm().equals(trueMultiFarm).not(), () => {
    trueMultiFarm_LinearTrueDistributor.setFarm(trueMultiFarm)
  })
  runIf(trueMultiFarm.isInitialized().not(), () => {
    trueMultiFarm.initialize(trueMultiFarm_LinearTrueDistributor, stkTruToken)
  })
  runIf(truSushiswapRewarder.isInitialized().not(), () => {
    truSushiswapRewarder.initialize(SUSHI_REWARD_MULTIPLIER, trustToken, SUSHI_MASTER_CHEF)
  })
})
