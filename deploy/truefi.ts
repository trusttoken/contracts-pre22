import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  LinearTrueDistributor,
  MockCurveGauge,
  MockTrueUSD,
  MockTruPriceOracle,
  OwnedUpgradeabilityProxy,
  RatingAgencyV2Distributor,
  StkTruToken,
  TestTrueFiPool,
  TestTrustToken,
  TruPriceOracle,
  TrueFiPool,
  TrueRatingAgencyV2,
} from '../build/artifacts'
import { utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

const DAY = 60 * 60 * 24

const TUSD = '0x0000000000085d4780B73119b644AE5ecd22b376'
const TRU = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
const Y_CRV_GAUGE = '0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1'
const DISTRIBUTION_DURATION = 180 * DAY
const DISTRIBUTION_START = Date.parse('04/24/2021') / 1000
const DISTRIBUTION_AMOUNT = utils.parseUnits('10', 8)

deploy({}, (_, config) => {
  const is_mainnet = config.network === 'mainnet'
  const NETWORK = is_mainnet ? 'mainnet' : 'testnet'

  const proxy = createProxy(OwnedUpgradeabilityProxy)

  // Existing contracts
  const tusd = is_mainnet
    ? TUSD
    : contract(MockTrueUSD)
  const trustToken = is_mainnet
    ? TRU
    : contract(TestTrustToken)

  // New contract impls
  const stkTruToken_impl = contract(StkTruToken)
  const trueFiPool_impl = contract(TrueFiPool)
  const testTrueFiPool_impl = contract(TestTrueFiPool)
  const stkTruToken_LinearTrueDistributor_impl = contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor)
  const trueRatingAgencyV2_impl = contract(TrueRatingAgencyV2)
  const ratingAgencyV2Distributor_impl = contract(RatingAgencyV2Distributor)

  // New contract proxies
  const stkTruToken = proxy(stkTruToken_impl, () => {})
  let trueFiPool = proxy(trueFiPool_impl, () => {})
  const testTrueFiPool = proxy(testTrueFiPool_impl, () => {})
  const stkTruToken_LinearTrueDistributor = proxy(stkTruToken_LinearTrueDistributor_impl, () => {})
  const trueRatingAgencyV2 = proxy(trueRatingAgencyV2_impl, () => {})
  const ratingAgencyV2Distributor = proxy(ratingAgencyV2Distributor_impl, () => {})

  // New bare contracts
  const yCrvGauge = is_mainnet
    ? Y_CRV_GAUGE
    : contract(MockCurveGauge)
  const truPriceOracle = is_mainnet
    ? contract(TruPriceOracle)
    : contract(MockTruPriceOracle)

  // Contract initialization
  runIf(testTrueFiPool.isInitialized().not(), () => {
    testTrueFiPool.initialize(AddressZero, yCrvGauge, tusd, AddressZero, AddressZero, AddressZero, AddressZero)
  })
  if (!is_mainnet) {
    trueFiPool = testTrueFiPool
  }
  runIf(stkTruToken_LinearTrueDistributor.isInitialized().not(), () => {
    stkTruToken_LinearTrueDistributor.initialize(DISTRIBUTION_START, DISTRIBUTION_DURATION, DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(stkTruToken_LinearTrueDistributor.farm().equals(stkTruToken).not(), () => {
    stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  })
  runIf(stkTruToken.initalized().not(), () => {
    stkTruToken.initialize(trustToken, trueFiPool, trueFiPool, stkTruToken_LinearTrueDistributor, AddressZero)
  })
  runIf(ratingAgencyV2Distributor.isInitialized().not(), () => {
    ratingAgencyV2Distributor.initialize(trueRatingAgencyV2, trustToken)
  })
  runIf(trueRatingAgencyV2.isInitialized().not(), () => {
    trueRatingAgencyV2.initialize(trustToken, stkTruToken, ratingAgencyV2Distributor, AddressZero)
  })
})
