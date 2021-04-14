import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  ArbitraryDistributor,
  GovernorAlpha,
  LinearTrueDistributor,
  Liquidator,
  LoanFactory,
  OwnedUpgradeabilityProxy,
  StkTruToken,
  Timelock,
  TimeOwnedUpgradeabilityProxy,
  TruPriceOracle,
  TrueFiPool,
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
const RATING_AGENCY_DISTRIBUTION_AMOUNT_IN_TRU = 10
const RATING_AGENCY_DISTRIBUTION_AMOUNT = parseTRU(RATING_AGENCY_DISTRIBUTION_AMOUNT_IN_TRU)
const TIMELOCK_DELAY = 10
const VOTING_PERIOD = 10

deploy({}, (deployer, config) => {
  const TIMELOCK_ADMIN = deployer
  const GOV_GUARDIAN = deployer
  const is_mainnet = config.network == 'mainnet'

  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeOwnedProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  const trueUSD = proxy(contract('trueUSD', TrueUSD), () => {})
  const trustToken = timeOwnedProxy(contract('trustToken', TrustToken), 'initialize',
    [],
  )
  const trueFiPool = proxy(contract('trueFiPool', TrueFiPool), () => {})
  const loanFactory = proxy(contract('loanFactory', LoanFactory), 'initialize',
    [trueUSD],
  )
  const truPriceOracle = contract('truPriceOracle', TruPriceOracle)
  const liquidator = proxy(contract('liquidator', Liquidator), 'initialize',
    [trueFiPool, stkTruToken, trustToken, truPriceOracle, loanFactory],
  )
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [DISTRIBUTION_START, DISTRIBUTION_DURATION, STAKE_DISTRIBUTION_AMOUNT, trustToken],
  )
  const stkTruToken = proxy(contract('stkTruToken', StkTruToken), 'initialize',
    [trustToken, trueFiPool, stkTruToken_LinearTrueDistributor, liquidator],
  )
  stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  const arbitraryDistributor = proxy(contract('arbitraryDistributor', ArbitraryDistributor), 'initialize',
    [trueRatingAgencyV2, trustToken, RATING_AGENCY_DISTRIBUTION_AMOUNT],
  )
  const trueRatingAgencyV2 = proxy(contract('trueRatingAgency2', TrueRatingAgencyV2), 'initialize',
    [trustToken, stkTruToken, arbitraryDistributor, loanFactory],
  )
  const timelock = proxy(contract(Timelock), 'initialize',
    [TIMELOCK_ADMIN, TIMELOCK_DELAY],
  )
  proxy(contract(GovernorAlpha), 'initialize',
    [timelock, trustToken, stkTruToken, GOV_GUARDIAN, VOTING_PERIOD],
  )
})
