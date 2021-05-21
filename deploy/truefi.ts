import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  GovernorAlpha,
  LinearTrueDistributor,
  Liquidator,
  LoanFactory,
  MockCurveGauge,
  MockTrueUSD,
  MockTruPriceOracle,
  OwnedUpgradeabilityProxy,
  RatingAgencyV2Distributor,
  StkTruToken,
  TestTrueFiPool,
  TestTrustToken,
  Timelock,
  TimeOwnedUpgradeabilityProxy,
  TruPriceOracle,
  TrueFarm,
  TrueFiPool,
  TrueRatingAgencyV2,
  TrueUSD,
  TrustToken,
  TrueLender,
  TrueLenderReclaimer,
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
    TIMELOCK_DELAY: 2 * DAY,
    VOTING_PERIOD: 10, // blocks
  },
  testnet: {
    DISTRIBUTION_DURATION: 180 * DAY,
    DISTRIBUTION_START: Date.parse('04/24/2021') / 1000,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('10', 8),
    TIMELOCK_DELAY: 2 * DAY,
    VOTING_PERIOD: 10, // blocks
  },
}

deploy({}, (deployer, config) => {
  const TIMELOCK_ADMIN = deployer
  const GOV_GUARDIAN = deployer
  const is_mainnet = config.network === 'mainnet'
  const NETWORK = is_mainnet ? 'mainnet' : 'testnet'

  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  // Existing contracts
  const trueUSD = is_mainnet
    ? proxy(contract(TrueUSD), () => {})
    : proxy(contract(MockTrueUSD), 'initialize',
      [],
    )
  const trustToken = is_mainnet
    ? timeProxy(contract(TrustToken), 'initialize',
      [],
    ) : timeProxy(contract(TestTrustToken), 'initialize',
      [],
    )

  // New contract impls
  const trueLender_impl = contract(TrueLender)
  const stkTruToken_impl = contract(StkTruToken)
  const trueFiPool_impl = contract(TrueFiPool)
  const testTrueFiPool_impl = contract(TestTrueFiPool)
  const loanFactory_impl = contract(LoanFactory)
  const liquidator_impl = contract(Liquidator)
  const stkTruToken_LinearTrueDistributor_impl = contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor)
  const trueRatingAgencyV2_impl = contract(TrueRatingAgencyV2)
  const ratingAgencyV2Distributor_impl = contract(RatingAgencyV2Distributor)
  const trueFiPool_LinearTrueDistributor_impl = contract('trueFiPool_LinearTrueDistributor', LinearTrueDistributor)
  const trueFiPool_TrueFarm_impl = contract('trueFiPool_TrueFarm', TrueFarm)
  const timelock_impl = contract(Timelock)
  const governorAlpha_impl = contract(GovernorAlpha)

  // New contract proxies
  const trueLender = proxy(trueLender_impl, () => {})
  const stkTruToken = proxy(stkTruToken_impl, () => {})
  const yCrvGauge = is_mainnet
    ? deployParams['mainnet'].Y_CRV_GAUGE
    : contract(MockCurveGauge)
  const trueFiPool = is_mainnet
    ? proxy(trueFiPool_impl, () => {})
    : proxy(testTrueFiPool_impl, 'initialize',
    [AddressZero, yCrvGauge, trueUSD, trueLender, AddressZero, stkTruToken, AddressZero, AddressZero],
  )
  const truPriceOracle = is_mainnet
    ? contract(TruPriceOracle)
    : contract(MockTruPriceOracle)
  const loanFactory = proxy(loanFactory_impl, 'initialize',
    [trueUSD],
  )
  const liquidator = proxy(liquidator_impl, 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(stkTruToken_LinearTrueDistributor_impl, 'initialize',
    [deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken],
  )
  runIf(stkTruToken_LinearTrueDistributor.farm().equals(stkTruToken).not(), () => {
    stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  })
  runIf(stkTruToken.initalized().not(), () => {
    stkTruToken.initialize(trustToken, trueFiPool, trueFiPool, stkTruToken_LinearTrueDistributor, liquidator)
  })
  const trueRatingAgencyV2 = proxy(trueRatingAgencyV2_impl, () => {})
  const ratingAgencyV2Distributor = proxy(ratingAgencyV2Distributor_impl, 'initialize',
    [trueRatingAgencyV2, trustToken],
  )
  runIf(trueRatingAgencyV2.isInitialized().not(), () => {
    trueRatingAgencyV2.initialize(trustToken, stkTruToken, ratingAgencyV2Distributor, loanFactory)
  })
  runIf(trueLender.isInitialized().not(), () => {
    trueLender.initialize(trueFiPool, trueRatingAgencyV2, stkTruToken)
  })
  const trueLenderReclaimer = contract(TrueLenderReclaimer, [trueLender])
  const trueFiPool_LinearTrueDistributor = proxy(trueFiPool_LinearTrueDistributor_impl, 'initialize',
    [deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken],
  )
  const trueFiPool_TrueFarm = proxy(trueFiPool_TrueFarm_impl, 'initialize',
    [trueFiPool, trueFiPool_LinearTrueDistributor, 'tfTUSD']
  )
  runIf(trueFiPool_LinearTrueDistributor.farm().equals(trueFiPool_TrueFarm).not(), () => {
    trueFiPool_LinearTrueDistributor.setFarm(trueFiPool_TrueFarm)
  })
  const timelock = proxy(timelock_impl, 'initialize',
    [TIMELOCK_ADMIN, deployParams[NETWORK].TIMELOCK_DELAY],
  )
  const governorAlpha = proxy(governorAlpha_impl, 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, deployParams[NETWORK].VOTING_PERIOD],
  )
})
