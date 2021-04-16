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
  TrueLender,
  TrueRatingAgencyV2,
  TrueUSD,
  TrustToken,
} from '../build/artifacts'
import { DAY, parseTRU } from '../test/utils'
import { AddressZero } from '@ethersproject/constants'

// TODO Fill values
const DISTRIBUTION_DURATION_IN_DAYS = 10
const DISTRIBUTION_DURATION = DISTRIBUTION_DURATION_IN_DAYS * DAY
const DISTRIBUTION_START_DATE = '02/18/2021'
const DISTRIBUTION_START = Date.parse(DISTRIBUTION_START_DATE) / 1000
const STAKE_DISTRIBUTION_AMOUNT_IN_TRU = 10
const STAKE_DISTRIBUTION_AMOUNT = parseTRU(STAKE_DISTRIBUTION_AMOUNT_IN_TRU)
const TIMELOCK_DELAY = 2 * DAY
const VOTING_PERIOD = 10

deploy({}, (deployer, config) => {
  const TIMELOCK_ADMIN = deployer
  const GOV_GUARDIAN = deployer
  const is_mainnet = config.network == 'mainnet'

  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  const trueUSD = proxy(contract('trueUSD', TrueUSD), () => {})
  const trustToken = is_mainnet ?
    timeProxy(contract('trustToken', TrustToken), 'initialize',
      [],
    ) : timeProxy(contract('testTrustToken', TestTrustToken), 'initialize',
      [],
    )
  const trueFiPool = proxy(contract('trueFiPool', TrueFiPool), () => {})
  const stkTruToken = proxy(contract('stkTruToken', StkTruToken), () => {})
  const truPriceOracle = contract('truPriceOracle', TruPriceOracle)
  const loanFactory = proxy(contract('loanFactory', LoanFactory), 'initialize',
    [trueUSD],
  )
  const liquidator = proxy(contract('liquidator', Liquidator), 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [DISTRIBUTION_START, DISTRIBUTION_DURATION, STAKE_DISTRIBUTION_AMOUNT, trustToken],
  )
  runIf(stkTruToken_LinearTrueDistributor.farm().equals(stkTruToken).not(), () => {
    stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  })
  runIf(stkTruToken.initalized().not(), () => {
    stkTruToken.initialize(trustToken, trueFiPool, stkTruToken_LinearTrueDistributor, liquidator)
  })
  const trueRatingAgencyV2 = proxy(contract('trueRatingAgencyV2', TrueRatingAgencyV2), () => {})
  const ratingAgencyV2Distributor = proxy(contract('ratingAgencyV2Distributor', RatingAgencyV2Distributor), 'initialize',
    [trueRatingAgencyV2, trustToken],
  )
  // TODO check whether trueRatingAgencyV2 has already been initialized, else this will revert
  trueRatingAgencyV2.initialize(trustToken, stkTruToken, ratingAgencyV2Distributor, loanFactory)
  // TODO figure out what's going wrong with deploying TrueLender
  // const trueLender = proxy(contract('trueLender', TrueLender), 'initialize',
  //   [trueFiPool, trueRatingAgencyV2, stkTruToken],
  // )
  const timelock = proxy(contract(Timelock), 'initialize',
    [TIMELOCK_ADMIN, TIMELOCK_DELAY],
  )
  proxy(contract(GovernorAlpha), 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, VOTING_PERIOD],
  )
})
