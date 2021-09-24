import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  OwnedUpgradeabilityProxy,
  LinearTrueDistributor,
  TestTrustToken,
  TimeOwnedUpgradeabilityProxy,
  TrueFarm,
  TrueFiPool,
  TrueMultiFarm,
  TrustToken,
} from '../build/artifacts'
import { utils, BigNumber } from 'ethers'

const DAY = 60 * 60 * 24
const YEAR = 365 * DAY
const TRU_DECIMALS = 8

const deployParams = {
  mainnet: {
    DISTRIBUTION_DURATION: 2 * YEAR,
    DISTRIBUTION_START: Math.floor(Date.now() / 1000) + DAY,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('330000', TRU_DECIMALS).mul(2 * 365),
  },
  testnet: {
    DISTRIBUTION_DURATION: 2 * YEAR,
    DISTRIBUTION_START: Math.floor(Date.now() / 1000) + DAY,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('330000', TRU_DECIMALS).mul(2 * 365),
  },
}

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

  // Existing contracts
  const trustToken = isMainnet
    ? timeProxy(contract(TrustToken), () => {})
    : timeProxy(contract(TestTrustToken), () => {})
  let trueFiPool = proxy(contract(TrueFiPool), () => {})

  // New contract impls
  const trueFiPool_LinearTrueDistributor_impl = contract('trueFiPool_LinearTrueDistributor', LinearTrueDistributor)
  const trueFiPool_TrueFarm_impl = contract('trueFiPool_TrueFarm', TrueFarm)
  const trueMultiFarm_LinearTrueDistributor_impl = contract('trueMultiFarm_LinearTrueDistributor', LinearTrueDistributor)
  const trueMultiFarm_impl = contract(TrueMultiFarm)

  // New contract proxies
  const trueFiPool_LinearTrueDistributor = proxy(trueFiPool_LinearTrueDistributor_impl, () => {})
  const trueFiPool_TrueFarm = proxy(trueFiPool_TrueFarm_impl, () => {})
  const trueMultiFarm_LinearTrueDistributor = proxy(trueMultiFarm_LinearTrueDistributor_impl, () => {})
  const trueMultiFarm = proxy(trueMultiFarm_impl, () => {})

  // New bare contracts
  // <None so far>

  // Contract initialization
  runIf(trueFiPool_LinearTrueDistributor.isInitialized().not(), () => {
    trueFiPool_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(trueFiPool_LinearTrueDistributor.farm().equals(trueFiPool_TrueFarm).not(), () => {
    trueFiPool_LinearTrueDistributor.setFarm(trueFiPool_TrueFarm)
  })
  runIf(trueFiPool_TrueFarm.isInitialized().not(), () => {
    trueFiPool_TrueFarm.initialize(trueFiPool, trueFiPool_LinearTrueDistributor, 'TrueFi tfTUSD Farm')
  })
  runIf(trueMultiFarm_LinearTrueDistributor.isInitialized().not(), () => {
    trueMultiFarm_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(trueMultiFarm_LinearTrueDistributor.farm().equals(trueMultiFarm).not(), () => {
    trueMultiFarm_LinearTrueDistributor.setFarm(trueMultiFarm)
  })
  runIf(trueMultiFarm.isInitialized().not(), () => {
    trueMultiFarm.initialize(trueMultiFarm_LinearTrueDistributor)
  })
})
