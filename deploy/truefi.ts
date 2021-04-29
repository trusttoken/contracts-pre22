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
  const trueLender = proxy(contract(TrueLender), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const yCrvGauge = is_mainnet
    ? deployParams['mainnet'].Y_CRV_GAUGE
    : contract(MockCurveGauge)
  const trueFiPool = is_mainnet
    ? proxy(contract(TrueFiPool), () => {})
    : proxy(contract(TestTrueFiPool), 'initialize',
      [AddressZero, yCrvGauge, trueUSD, trueLender, AddressZero, stkTruToken, AddressZero, AddressZero],
    )
  const truPriceOracle = is_mainnet
    ? contract(TruPriceOracle)
    : contract(MockTruPriceOracle)
  const loanFactory = proxy(contract(LoanFactory), 'initialize',
    [trueUSD],
  )
  const liquidator = proxy(contract(Liquidator), 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken],
  )
  runIf(stkTruToken_LinearTrueDistributor.farm().equals(stkTruToken).not(), () => {
    stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  })
  runIf(stkTruToken.initalized().not(), () => {
    stkTruToken.initialize(trustToken, trueFiPool, trueFiPool, stkTruToken_LinearTrueDistributor, liquidator)
  })
  const trueRatingAgencyV2 = proxy(contract(TrueRatingAgencyV2), () => {})
  const ratingAgencyV2Distributor = proxy(contract(RatingAgencyV2Distributor), 'initialize',
    [trueRatingAgencyV2, trustToken],
  )
  runIf(trueRatingAgencyV2.isInitialized().not(), () => {
    trueRatingAgencyV2.initialize(trustToken, stkTruToken, ratingAgencyV2Distributor, loanFactory)
  })
  runIf(trueLender.isInitialized().not(), () => {
    trueLender.initialize(trueFiPool, trueRatingAgencyV2, stkTruToken)
  })
  const trueLenderReclaimer = contract(TrueLenderReclaimer, [trueLender])
  const timelock = proxy(contract(Timelock), 'initialize',
    [TIMELOCK_ADMIN, deployParams[NETWORK].TIMELOCK_DELAY],
  )
  const governorAlpha = proxy(contract(GovernorAlpha), 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, deployParams[NETWORK].VOTING_PERIOD],
  )
})
