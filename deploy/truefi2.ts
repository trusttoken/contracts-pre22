import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
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
import { BigNumber, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

const DAY = 60 * 60 * 24

const ONE_INCH_EXCHANGE = '0x11111112542d85b3ef69ae05771c2dccff4faa26'
const TUSD = '0x0000000000085d4780B73119b644AE5ecd22b376'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const TRU = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
const LOAN_INTEREST_FEE = 500

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

  // Existing contracts
  const trustToken = isMainnet
    ? TRU
    : contract(TestTrustToken)
  const stkTruToken = proxy(contract(StkTruToken), () => { })
  const tusd = isMainnet
    ? TUSD
    : contract(MockTrueUSD)
  const usdc = isMainnet
    ? USDC
    : contract(TestUSDCToken)
  const usdt = isMainnet
    ? USDT
    : contract(TestUSDTToken)

  // New contract impls
  const trueLender2_impl = contract(TrueLender2)
  const ftlAgency_impl = contract(FixedTermLoanAgency)
  const poolFactory_impl = contract(PoolFactory)
  const liquidator2_impl = contract(Liquidator2)
  const loanFactory2_impl = contract(LoanFactory2)
  const safu_impl = contract(SAFU)
  const trueFiCreditOracle_impl = contract(TrueFiCreditOracle)
  const borrowingMutex_impl = contract(BorrowingMutex)

  // New contract proxies
  const trueLender2 = proxy(trueLender2_impl, () => { })
  const ftlAgency = proxy(ftlAgency_impl, () => { })
  const poolFactory = proxy(poolFactory_impl, () => { })
  const liquidator2 = proxy(liquidator2_impl, () => { })
  const loanFactory2 = proxy(loanFactory2_impl, () => { })
  const trueFiCreditOracle = proxy(trueFiCreditOracle_impl, () => { })
  const safu = proxy(safu_impl, () => { })
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
    poolFactory.initialize(implementationReference, trueLender2, ftlAgency, safu)
  })
  runIf(trueLender2.isInitialized().not(), () => {
    trueLender2.initialize(stkTruToken, poolFactory, oneInch, trueFiCreditOracle, AddressZero, borrowingMutex)
  })
  runIf(ftlAgency.isInitialized().not(), () => {
    ftlAgency.initialize(stkTruToken, poolFactory, oneInch, trueFiCreditOracle, AddressZero, borrowingMutex, loanFactory2)
  })
  runIf(loanFactory2.isInitialized().not(), () => {
    loanFactory2.initialize(poolFactory, trueLender2, ftlAgency, liquidator2, AddressZero, trueFiCreditOracle, borrowingMutex, AddressZero)
  })
  runIf(liquidator2.isInitialized().not(), () => {
    liquidator2.initialize(stkTruToken, trustToken, loanFactory2, poolFactory, AddressZero, AddressZero)
  })
  runIf(poolFactory.pool(usdc).equals(AddressZero), () => {
    poolFactory.allowToken(usdc, true)
    poolFactory.createPool(usdc)
  })
  const usdc_TrueFiPool2 = poolFactory.pool(usdc)
  runIf(trueLender2.feePool().equals(AddressZero), () => {
    trueLender2.setFeePool(usdc_TrueFiPool2)
  })
  runIf(ftlAgency.feePool().equals(AddressZero), () => {
    ftlAgency.setFeePool(usdc_TrueFiPool2)
  })
  runIf(poolFactory.pool(usdt).equals(AddressZero), () => {
    poolFactory.allowToken(usdt, true)
    poolFactory.createPool(usdt)
  })
  const usdt_TrueFiPool2 = poolFactory.pool(usdt)
  runIf(trueFiCreditOracle.isInitialized().not(), () => {
    trueFiCreditOracle.initialize()
  })
  if (!isMainnet) {
    trueLender2.setFee(LOAN_INTEREST_FEE)
    ftlAgency.setFee(LOAN_INTEREST_FEE)
  }
})
