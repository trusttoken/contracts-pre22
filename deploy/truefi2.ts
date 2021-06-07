import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  ImplementationReference,
  LinearTrueDistributor,
  Liquidator2,
  LoanFactory2, Mock1InchV3,
  TestUSDCToken,
  OwnedUpgradeabilityProxy,
  PoolFactory,
  StkTruToken,
  TestTrueFiPool,
  TestTrustToken,
  TimeOwnedUpgradeabilityProxy,
  TrueFarm,
  TrueFiPool,
  TrueFiPool2,
  TrueLender2,
  TrueRatingAgencyV2,
  TrustToken,
  ChainlinkTruUsdcOracle,
} from '../build/artifacts'
import { utils, BigNumber } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

const DAY = 60 * 60 * 24

// TODO set this properly for testnets or deploy a mock
const ONE_INCH_EXCHANGE = '0x11111112542d85b3ef69ae05771c2dccff4faa26'
const deployParams = {
  mainnet: {
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DISTRIBUTION_DURATION: 14 * DAY,
    DISTRIBUTION_START: 1621529911,
    // 290,934 per day for 14 days
    STAKE_DISTRIBUTION_AMOUNT: BigNumber.from('407307600000000'),
    WITHDRAW_PERIOD: 3 * DAY,
  },
  testnet: {
    LOAN_INTEREST_FEE: 500,
    DISTRIBUTION_DURATION: 180 * DAY,
    DISTRIBUTION_START: Date.parse('04/24/2021') / 1000,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('10', 8),
    WITHDRAW_PERIOD: 3 * DAY,
  },
}

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

  // Existing contracts
  const trustToken = isMainnet
    ? timeProxy(contract(TrustToken), () => {})
    : timeProxy(contract(TestTrustToken), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const trueFiPool = isMainnet
    ? proxy(contract(TrueFiPool), () => {})
    : proxy(contract(TestTrueFiPool), () => {})
  const usdc = isMainnet
    ? deployParams['mainnet'].USDC
    : contract(TestUSDCToken)
  const trueRatingAgencyV2 = proxy(contract(TrueRatingAgencyV2), () => {})

  // New contract impls
  const trueLender2_impl = contract(TrueLender2)
  const poolFactory_impl = contract(PoolFactory)
  const liquidator2_impl = contract(Liquidator2)
  const loanFactory2_impl = contract(LoanFactory2)
  const usdc_TrueFiPool2_LinearTrueDistributor_impl = contract('usdc_TrueFiPool2_LinearTrueDistributor', LinearTrueDistributor)
  const usdc_TrueFiPool2_TrueFarm_impl = contract('usdc_TrueFiPool2_TrueFarm', TrueFarm)

  // New contract proxies
  const trueLender2 = proxy(trueLender2_impl, () => {})
  const poolFactory = proxy(poolFactory_impl, () => {})
  const liquidator2 = proxy(liquidator2_impl, () => {})
  const loanFactory2 = proxy(loanFactory2_impl, () => {})
  const usdc_TrueFiPool2_LinearTrueDistributor = proxy(usdc_TrueFiPool2_LinearTrueDistributor_impl, () => {})
  const usdc_TrueFiPool2_TrueFarm = proxy(usdc_TrueFiPool2_TrueFarm_impl, () => {})

  // New bare contracts
  const trueFiPool2 = contract(TrueFiPool2)
  const implementationReference = contract(ImplementationReference, [trueFiPool2])
  const chainlinkTruUsdcOracle = contract(ChainlinkTruUsdcOracle)
  const oneInch = isMainnet ? ONE_INCH_EXCHANGE : contract(Mock1InchV3)

  // Contract initialization
  runIf(poolFactory.isInitialized().not(), () => {
    poolFactory.initialize(implementationReference, trustToken, trueLender2)
  })
  runIf(trueLender2.isInitialized().not(), () => {
    trueLender2.initialize(stkTruToken, poolFactory, trueRatingAgencyV2, oneInch)
  })
  runIf(trueLender2.votingPeriod().equals(deployParams[NETWORK].WITHDRAW_PERIOD).not(), () => {
    trueLender.setVotingPeriod(deployParams[NETWORK].WITHDRAW_PERIOD)
  })
  runIf(loanFactory2.isInitialized().not(), () => {
    loanFactory2.initialize(poolFactory, trueLender2, liquidator2)
  })
  runIf(liquidator2.isInitialized().not(), () => {
    liquidator2.initialize(stkTruToken, trustToken, loanFactory2)
  })
  runIf(poolFactory.pool(usdc).equals(AddressZero), () => {
    poolFactory.whitelist(usdc, true)
    poolFactory.createPool(usdc)
  })
  const usdc_TrueFiPool2 = poolFactory.pool(usdc)
  runIf(trueLender2.feePool().equals(AddressZero), () => {
    trueLender2.setFeePool(usdc_TrueFiPool2)
  })
  runIf(usdc_TrueFiPool2_LinearTrueDistributor.isInitialized().not(), () => {
    usdc_TrueFiPool2_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(usdc_TrueFiPool2_LinearTrueDistributor.farm().equals(usdc_TrueFiPool2_TrueFarm).not(), () => {
    usdc_TrueFiPool2_LinearTrueDistributor.setFarm(usdc_TrueFiPool2_TrueFarm)
  })
  runIf(usdc_TrueFiPool2_TrueFarm.isInitialized().not(), () => {
    usdc_TrueFiPool2_TrueFarm.initialize(usdc_TrueFiPool2, usdc_TrueFiPool2_LinearTrueDistributor, 'TrueFi tfUSDC Farm')
  })
  if (!isMainnet) {
    trueLender2.setFee(deployParams['testnet'].LOAN_INTEREST_FEE)
  }
  runIf(poolFactory.isPool(trueFiPool).not(), () => {
    poolFactory.addLegacyPool(trueFiPool)
  })
})
