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
  TrustToken,
} from '../build/artifacts'
import { DAY, parseTRU } from '../test/utils'
import { AddressZero } from '@ethersproject/constants'

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
  const trustToken = timeOwnedProxy(contract('trustToken', TrustToken), () => {})
  const trueFiPool = proxy(contract('trueFiPool', TrueFiPool), () => {})
  const loanFactory = proxy(contract('loanFactory', LoanFactory), () => {})
  proxy(contract('trueRatingAgency', TrueRatingAgency), () => {})

  // New contracts
  const distributionStart = Date.parse(DISTRIBUTION_START) / 1000
  const length = DISTRIBUTION_LENGTH_IN_DAYS * DAY
  const stkTruToken_LinearTrueDistributor = proxy(contract('stkTruToken_LinearTrueDistributor', LinearTrueDistributor), 'initialize',
    [distributionStart, length, parseTRU(STAKE_DISTRIBUTION_AMOUNT_IN_TRU), trustToken],
  )
  const stkTruToken = proxy(contract('stkTruToken', StkTruToken), 'initialize', [trustToken, trueFiPool, stkTruToken_LinearTrueDistributor, trustToken])
  stkTruToken_LinearTrueDistributor.setFarm(stkTruToken)
  trueFiPool.setStakeToken(stkTruToken)

  const timelock = proxy(contract(Timelock), 'initialize', [TIMELOCK_ADMIN, TIMELOCK_DELAY])
  proxy(contract(GovernorAlpha), 'initialize', [timelock, trustToken, GOV_GUARDIAN, stkTruToken, VOTING_PERIOD])

  const trueRatingAgencyV2 = proxy(contract('trueRatingAgency2', TrueRatingAgencyV2), () => {})
  const arbitraryDistributor = proxy(contract('arbitraryDistributor', ArbitraryDistributor), 'initialize',
    [trueRatingAgencyV2, trustToken, parseTRU(RATING_AGENCY_DISTRIBUTION_AMOUNT_IN_TRU)],
  )
  trueRatingAgencyV2.initialize(trustToken, stkTruToken, arbitraryDistributor, loanFactory)

  const uniswapOracle = contract('uniswapOracle', AddressZero, ['0xb4d0d9df2738abe81b87b66c80851292492d1404', '0xec6a6b7db761a5c9910ba8fcab98116d384b1b85'])
  proxy(contract('liquidator', Liquidator), 'initialize', [trueFiPool, stkTruToken, trustToken, uniswapOracle, loanFactory])
})
