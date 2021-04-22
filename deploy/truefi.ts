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
  TrueFiPool,
  TrueRatingAgencyV2,
  TrueUSD,
  TrustToken,
} from '../build/artifacts'
import { utils } from 'ethers'

const DAY = 60 * 60 * 24

// TODO Fill values
const DISTRIBUTION_DURATION_IN_DAYS = 10
const DISTRIBUTION_DURATION = DISTRIBUTION_DURATION_IN_DAYS * DAY
const DISTRIBUTION_START_DATE = '02/18/2021'
const DISTRIBUTION_START = Date.parse(DISTRIBUTION_START_DATE) / 1000
const STAKE_DISTRIBUTION_AMOUNT_IN_TRU = 10
const STAKE_DISTRIBUTION_AMOUNT = utils.parseUnits(STAKE_DISTRIBUTION_AMOUNT_IN_TRU.toString(), 8)
const TIMELOCK_DELAY = 2 * DAY
const VOTING_PERIOD = 10

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
  const trueFiPool = proxy(contract(TrueFiPool), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const truPriceOracle = contract(TruPriceOracle)
  const loanFactory = proxy(contract(LoanFactory), 'initialize',
    [trueUSD],
  )
  const liquidator = proxy(contract(Liquidator), 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [DISTRIBUTION_START, DISTRIBUTION_DURATION, STAKE_DISTRIBUTION_AMOUNT, trustToken],
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
  // TODO figure out what's going wrong with deploying TrueLender
  // const trueLender = proxy(contract(TrueLender), 'initialize',
  //   [trueFiPool, trueRatingAgencyV2, stkTruToken],
  // )
  const timelock = proxy(contract(Timelock), 'initialize',
    [TIMELOCK_ADMIN, TIMELOCK_DELAY],
  )
  proxy(contract(GovernorAlpha), 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, VOTING_PERIOD],
  )
})
