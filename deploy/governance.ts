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
  TrueFiPool, TrueRatingAgency,
  TrueRatingAgencyV2,
  TruPriceUniswapOracle,
  TrustToken,
} from '../build/artifacts'
import { DAY, parseTRU } from '../test/utils'

// TODO Fill values
const DISTRIBUTION_LENGTH_IN_DAYS = 10
const DISTRIBUTION_START = '02/18/2021'
const STAKE_DISTRIBUTION_AMOUNT_IN_TRU = 10
const RATING_AGENCY_DISTRIBUTION_AMOUNT_IN_TRU = 10
const TIMELOCK_DELAY = 10
const VOTING_PERIOD = 10

deploy({}, (deployer) => {
  const TIMELOCK_ADMIN = deployer
  const GOV_GUARDIAN = deployer

  const proxy = createProxy(OwnedUpgradeabilityProxy)


  const timeOwnedProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  // Existing contracts
  const tru = timeOwnedProxy(contract('tru', TrustToken), () => {})
  const pool = proxy(contract('pool', TrueFiPool), () => {})
  const factory = proxy(contract('factory', LoanFactory), () => {})
  proxy(contract('ratingAgency', TrueRatingAgency), () => {})

  // New contracts
  const distributionStart = Date.parse(DISTRIBUTION_START) / 1000
  const length = DISTRIBUTION_LENGTH_IN_DAYS * DAY
  const distributor = proxy(contract('stkTruDistributor', LinearTrueDistributor), 'initialize',
    [distributionStart, length, parseTRU(STAKE_DISTRIBUTION_AMOUNT_IN_TRU), tru],
  )
  const stkTru = proxy(contract('stkTru', StkTruToken), 'initialize', [tru, pool, distributor, tru])
  distributor.setFarm(stkTru)
  pool.setStakeToken(stkTru)

  const timelock = proxy(contract(Timelock), 'initialize', [TIMELOCK_ADMIN, TIMELOCK_DELAY])
  proxy(contract(GovernorAlpha), 'initialize', [timelock, tru, GOV_GUARDIAN, stkTru, VOTING_PERIOD])

  const trueRatingAgencyV2 = proxy(contract('ratingAgency2', TrueRatingAgencyV2), () => {})
  const arbitraryDistributor = proxy(contract('arbitraryDistributor2', ArbitraryDistributor), 'initialize',
    [trueRatingAgencyV2, tru, parseTRU(RATING_AGENCY_DISTRIBUTION_AMOUNT_IN_TRU)],
  )
  trueRatingAgencyV2.initialize(tru, stkTru, arbitraryDistributor, factory)

  const oracle = contract('uniswapOracle', TruPriceUniswapOracle, ['0xb4d0d9df2738abe81b87b66c80851292492d1404', '0xec6a6b7db761a5c9910ba8fcab98116d384b1b85'])
  proxy(contract('liquidator', Liquidator), 'initialize', [pool, stkTru, tru, oracle, factory])
})
