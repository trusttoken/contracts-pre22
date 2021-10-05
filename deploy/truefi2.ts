import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import { BigNumber, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

import {
  BorrowingMutex,
  ChainlinkTruTusdOracle,
  ChainlinkTruUsdcOracle,
  ChainlinkTruUsdtOracle,
  FixedTermLoanAgency,
  ImplementationReference,
  Liquidator2,
  LoanFactory2,
  Mock1InchV3,
  MockTrueUSD,
  OwnedUpgradeabilityProxy,
  PoolFactory,
  SAFU,
  StkTruToken,
  TestTrustToken,
  TestUSDCToken,
  TestUSDTToken,
  TrueFiCreditOracle,
  TrueFiPool2,
  TrueLender2,
} from '../build/artifacts'
import {
  TUSD, USDC, USDT, TRU, ONE_INCH_EXCHANGE, LOAN_INTEREST_FEE
} from './config.json'

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'

  // Existing contracts
  const tusd = isMainnet
    ? TUSD
    : contract(MockTrueUSD)
  const usdc = isMainnet
    ? USDC
    : contract(TestUSDCToken)
  const usdt = isMainnet
    ? USDT
    : contract(TestUSDTToken)
  const trustToken = isMainnet
    ? TRU
    : contract(TestTrustToken)
  const stkTruToken = proxy(contract(StkTruToken), () => { })

  // New contract impls
  const safu_impl = contract(SAFU)
  const poolFactory_impl = contract(PoolFactory)
  const trueLender2_impl = contract(TrueLender2)
  const ftlAgency_impl = contract(FixedTermLoanAgency)
  const liquidator2_impl = contract(Liquidator2)
  const loanFactory2_impl = contract(LoanFactory2)
  const trueFiCreditOracle_impl = contract(TrueFiCreditOracle)
  const borrowingMutex_impl = contract(BorrowingMutex)

  // New contract proxies
  const safu = proxy(safu_impl, () => { })
  const poolFactory = proxy(poolFactory_impl, () => { })
  const trueLender2 = proxy(trueLender2_impl, () => { })
  const ftlAgency = proxy(ftlAgency_impl, () => { })
  const liquidator2 = proxy(liquidator2_impl, () => { })
  const loanFactory2 = proxy(loanFactory2_impl, () => { })
  const trueFiCreditOracle = proxy(trueFiCreditOracle_impl, () => { })
  const borrowingMutex = proxy(borrowingMutex_impl, () => { })

  // New bare contracts
  const trueFiPool2 = contract(TrueFiPool2)
  const implementationReference = contract(ImplementationReference, [trueFiPool2])
  const chainlinkTruTusdOracle = contract(ChainlinkTruTusdOracle)
  const chainlinkTruUsdcOracle = contract(ChainlinkTruUsdcOracle)
  const chainlinkTruUsdtOracle = contract(ChainlinkTruUsdtOracle)
  const oneInch = isMainnet ? ONE_INCH_EXCHANGE : contract(Mock1InchV3)

  // Contract initialization
  runIf(safu.isInitialized().not(), () => {
    safu.initialize(loanFactory2, liquidator2, oneInch)
  })
  runIf(poolFactory.isInitialized().not(), () => {
    poolFactory.initialize(implementationReference, trueLender2, ftlAgency, safu, loanFactory2)
  })
  runIf(trueLender2.isInitialized().not(), () => {
    trueLender2.initialize(stkTruToken, poolFactory, oneInch)
  })
  runIf(ftlAgency.isInitialized().not(), () => {
    ftlAgency.initialize(stkTruToken, poolFactory, oneInch, trueFiCreditOracle, AddressZero, borrowingMutex, loanFactory2)
  })
  runIf(liquidator2.isInitialized().not(), () => {
    liquidator2.initialize(stkTruToken, trustToken, loanFactory2, poolFactory, AddressZero, AddressZero)
  })
  runIf(loanFactory2.isInitialized().not(), () => {
    loanFactory2.initialize(poolFactory, ftlAgency, liquidator2, AddressZero, trueFiCreditOracle, borrowingMutex, AddressZero)
  })
  runIf(trueFiCreditOracle.isInitialized().not(), () => {
    trueFiCreditOracle.initialize()
  })
  runIf(borrowingMutex.isInitialized().not(), () => {
    borrowingMutex.initialize()
  })

  runIf(poolFactory.pool(tusd).equals(AddressZero), () => {
    poolFactory.allowToken(tusd, true)
    poolFactory.createPool(tusd)
  })
  const tusd_TrueFiPool2 = poolFactory.pool(tusd)
  runIf(poolFactory.pool(usdc).equals(AddressZero), () => {
    poolFactory.allowToken(usdc, true)
    poolFactory.createPool(usdc)
  })
  const usdc_TrueFiPool2 = poolFactory.pool(usdc)
  runIf(poolFactory.pool(usdt).equals(AddressZero), () => {
    poolFactory.allowToken(usdt, true)
    poolFactory.createPool(usdt)
  })
  const usdt_TrueFiPool2 = poolFactory.pool(usdt)

  runIf(trueLender2.feePool().equals(AddressZero), () => {
    trueLender2.setFeePool(usdc_TrueFiPool2)
  })
  runIf(ftlAgency.feePool().equals(AddressZero), () => {
    ftlAgency.setFeePool(usdc_TrueFiPool2)
  })
  if (!isMainnet) {
    trueLender2.setFee(LOAN_INTEREST_FEE)
    ftlAgency.setFee(LOAN_INTEREST_FEE)
  }
})
