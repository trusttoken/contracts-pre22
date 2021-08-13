import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  GovernorAlpha,
  LinearTrueDistributor,
  LoanFactory,
  MockCurveGauge,
  MockTrueUSD,
  MockTruPriceOracle,
  OwnedUpgradeabilityProxy,
  RatingAgencyV2Distributor,
  StkTruToken,
  SushiTimelock,
  TestTrueFiPool,
  TestTrustToken,
  Timelock,
  TimeOwnedUpgradeabilityProxy,
  TruPriceOracle,
  TruSushiswapRewarder,
  TrueFarm,
  TrueFiPool,
  TrueRatingAgencyV2,
  TrueUSD,
  TrustToken,
  TrueLender,
} from '../build/artifacts'
import { utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

const DAY = 60 * 60 * 24

// TODO Fill values
const deployParams = {
  mainnet: {
    Y_CRV_GAUGE: '0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1',
    DISTRIBUTION_DURATION: 180 * DAY,
    DISTRIBUTION_START: Date.parse('04/24/2021') / 1000,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('10', 8),
    SUSHI_MASTER_CHEF: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd',
    SUSHI_REWARD_MULTIPLIER: 100,
    TIMELOCK_DELAY: 2 * DAY,
    VOTING_PERIOD: 10, // blocks
  },
  testnet: {
    DISTRIBUTION_DURATION: 180 * DAY,
    DISTRIBUTION_START: Date.parse('04/24/2021') / 1000,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('10', 8),
    SUSHI_MASTER_CHEF: AddressZero, // TODO replace with a test address
    SUSHI_REWARD_MULTIPLIER: 100,
    TIMELOCK_DELAY: 2 * DAY,
    VOTING_PERIOD: 10, // blocks
  },
}

deploy({}, (deployer, config) => {
  // const TIMELOCK_ADMIN = deployer
  // const GOV_GUARDIAN = deployer
  // const is_mainnet = config.network === 'mainnet'
  // const NETWORK = is_mainnet ? 'mainnet' : 'testnet'

  // const proxy = createProxy(OwnedUpgradeabilityProxy)
  // const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  // // Existing contracts
  // const trueUSD = is_mainnet
  //   ? proxy(contract(TrueUSD), () => {})
  //   : proxy(contract(MockTrueUSD), 'initialize',
  //     [],
  //   )
  // const trustToken = is_mainnet
  //   ? timeProxy(contract(TrustToken), 'initialize',
  //     [],
  //   ) : timeProxy(contract(TestTrustToken), 'initialize',
  //     [],
  //   )

  // // New contract impls
  // const trueLender_impl = contract(TrueLender)
  // const stkTruToken_impl = contract(StkTruToken)
  const trueFiPool_impl = contract(TrueFiPool)
  // const testTrueFiPool_impl = contract(TestTrueFiPool)
  // const loanFactory_impl = contract(LoanFactory)
  // const stkTruToken_LinearTrueDistributor_impl = contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor)
  // const trueRatingAgencyV2_impl = contract(TrueRatingAgencyV2)
  // const ratingAgencyV2Distributor_impl = contract(RatingAgencyV2Distributor)
  // const trueFiPool_LinearTrueDistributor_impl = contract('trueFiPool_LinearTrueDistributor', LinearTrueDistributor)
  // const trueFiPool_TrueFarm_impl = contract('trueFiPool_TrueFarm', TrueFarm)
  // const truSushiswapRewarder_impl = contract(TruSushiswapRewarder)
  // const timelock_impl = contract(Timelock)
  // const governorAlpha_impl = contract(GovernorAlpha)

  // // New contract proxies
  // const trueLender = proxy(trueLender_impl, () => {})
  // const stkTruToken = proxy(stkTruToken_impl, () => {})
  // let trueFiPool = proxy(trueFiPool_impl, () => {})
  // const testTrueFiPool = proxy(testTrueFiPool_impl, () => {})
  // const loanFactory = proxy(loanFactory_impl, () => {})
  // const stkTruToken_LinearTrueDistributor = proxy(stkTruToken_LinearTrueDistributor_impl, () => {})
  // const trueRatingAgencyV2 = proxy(trueRatingAgencyV2_impl, () => {})
  // const ratingAgencyV2Distributor = proxy(ratingAgencyV2Distributor_impl, () => {})
  // const trueFiPool_LinearTrueDistributor = proxy(trueFiPool_LinearTrueDistributor_impl, () => {})
  // const trueFiPool_TrueFarm = proxy(trueFiPool_TrueFarm_impl, () => {})
  // const truSushiswapRewarder = proxy(truSushiswapRewarder_impl, () => {})
  // const timelock = proxy(timelock_impl, () => {})
  // const governorAlpha = proxy(governorAlpha_impl, () => {})

  // // New bare contracts
  // const yCrvGauge = is_mainnet
  //   ? deployParams['mainnet'].Y_CRV_GAUGE
  //   : contract(MockCurveGauge)
  // const truPriceOracle = is_mainnet
  //   ? contract(TruPriceOracle)
  //   : contract(MockTruPriceOracle)
  // const sushiTimelock = contract(SushiTimelock, [TIMELOCK_ADMIN, deployParams[NETWORK].TIMELOCK_DELAY])

  // // Contract initialization
  // runIf(testTrueFiPool.isInitialized().not(), () => {
  //   testTrueFiPool.initialize(AddressZero, yCrvGauge, trueUSD, trueLender, AddressZero, AddressZero, AddressZero)
  // })
  // if (!is_mainnet) {
  //   trueFiPool = testTrueFiPool
  // }
  // runIf(loanFactory.isInitialized().not(), () => {
  //   loanFactory.initialize(trueUSD)
  // })
  // runIf(stkTruToken_LinearTrueDistributor.isInitialized().not(), () => {
  //   stkTruToken_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  // })
  // runIf(stkTruToken_LinearTrueDistributor.farm().equals(stkTruToken).not(), () => {
  //   stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  // })
  // runIf(stkTruToken.initalized().not(), () => {
  //   stkTruToken.initialize(trustToken, trueFiPool, trueFiPool, stkTruToken_LinearTrueDistributor, AddressZero)
  // })
  // runIf(ratingAgencyV2Distributor.isInitialized().not(), () => {
  //   ratingAgencyV2Distributor.initialize(trueRatingAgencyV2, trustToken)
  // })
  // runIf(trueRatingAgencyV2.isInitialized().not(), () => {
  //   trueRatingAgencyV2.initialize(trustToken, stkTruToken, ratingAgencyV2Distributor, loanFactory)
  // })
  // runIf(trueLender.isInitialized().not(), () => {
  //   trueLender.initialize(trueFiPool, trueRatingAgencyV2, stkTruToken)
  // })
  // runIf(trueFiPool_LinearTrueDistributor.isInitialized().not(), () => {
  //   trueFiPool_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  // })
  // runIf(trueFiPool_LinearTrueDistributor.farm().equals(trueFiPool_TrueFarm).not(), () => {
  //   trueFiPool_LinearTrueDistributor.setFarm(trueFiPool_TrueFarm)
  // })
  // runIf(trueFiPool_TrueFarm.isInitialized().not(), () => {
  //   trueFiPool_TrueFarm.initialize(trueFiPool, trueFiPool_LinearTrueDistributor, 'TrueFi tfTUSD Farm')
  // })
  // runIf(truSushiswapRewarder.isInitialized().not(), () => {
  //   truSushiswapRewarder.initialize(deployParams[NETWORK].SUSHI_REWARD_MULTIPLIER, trustToken, deployParams[NETWORK].SUSHI_MASTER_CHEF)
  // })
  // runIf(timelock.isInitialized().not(), () => {
  //   timelock.initialize(TIMELOCK_ADMIN, deployParams[NETWORK].TIMELOCK_DELAY)
  // })
  // runIf(governorAlpha.isInitialized().not(), () => {
  //   governorAlpha.initialize(timelock, trustToken, stkTruToken, GOV_GUARDIAN, deployParams[NETWORK].VOTING_PERIOD)
  // })
})
