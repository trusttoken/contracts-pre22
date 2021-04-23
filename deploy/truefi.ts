import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  GovernorAlpha,
  LinearTrueDistributor,
  Liquidator,
  LoanFactory,
  OwnedUpgradeabilityProxy,
  RatingAgencyV2Distributor,
  StkTruToken,
  TestTrustToken,
  Timelock,
  TimeOwnedUpgradeabilityProxy,
  TruPriceOracle,
  TestTrueFiPool,
  TrueRatingAgencyV2,
  TrueUSD,
  TrustToken,
  TrueLender,
  MockCurveGauge,
} from '../build/artifacts'
import { utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

const DAY = 60 * 60 * 24

// TODO Fill values
const deployParams = {
  kovan: {
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

  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  const trueUSD = proxy(contract(TrueUSD), () => {})
  const trustToken = is_mainnet
    ? timeProxy(contract(TrustToken), 'initialize',
      [],
    ) : timeProxy(contract(TestTrustToken), 'initialize',
      [],
    )
  const lender = proxy(contract(TrueLender), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const gauge = contract(MockCurveGauge)
  const trueFiPool = proxy(contract(TestTrueFiPool), 'initialize',
    [AddressZero, gauge, trueUSD, lender, AddressZero, stkTruToken, AddressZero, AddressZero],
  )
  const truPriceOracle = contract(TruPriceOracle)
  const loanFactory = proxy(contract(LoanFactory), 'initialize',
    [trueUSD],
  )
  const liquidator = proxy(contract(Liquidator), 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [deployParams[config.network].DISTRIBUTION_START, deployParams[config.network].DISTRIBUTION_DURATION, deployParams[config.network].STAKE_DISTRIBUTION_AMOUNT, trustToken],
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
  runIf(lender.isInitialized().not(), () => {
    lender.initialize(trueFiPool, trueRatingAgencyV2, stkTruToken)
  })
  const timelock = proxy(contract(Timelock), 'initialize',
    [TIMELOCK_ADMIN, deployParams[config.network].TIMELOCK_DELAY],
  )
  proxy(contract(GovernorAlpha), 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, deployParams[config.network].VOTING_PERIOD],
  )
})
