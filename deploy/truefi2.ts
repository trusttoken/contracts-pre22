import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  ImplementationReference,
  Liquidator2,
  LoanFactory2, Mock1InchV3,
  TestUSDCToken,
  OwnedUpgradeabilityProxy,
  PoolFactory,
  StkTruToken,
  TestTrueFiPool,
  TestTrustToken,
  TimeOwnedUpgradeabilityProxy,
  TrueFiPool,
  TrueFiPool2,
  TrueLender2,
  TrueRatingAgencyV2,
  TrustToken,
} from '../build/artifacts'
import { AddressZero } from '@ethersproject/constants'

// TODO set this properly for testnets or deploy a mock
const ONE_INCH_EXCHANGE = '0x11111112542d85b3ef69ae05771c2dccff4faa26'
const deployParams = {
  mainnet: {
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  testnet: {
    LOAN_INTEREST_FEE: 500,
  },
}

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'

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

  // New contracts
  const trueLender2 = proxy(contract(TrueLender2), () => {})
  const trueFiPool2 = contract(TrueFiPool2)
  const implementationReference = contract(ImplementationReference, [trueFiPool2])
  const poolFactory = proxy(contract(PoolFactory), 'initialize',
    [implementationReference, trustToken, trueLender2],
  )
  const oneInch = isMainnet ? ONE_INCH_EXCHANGE : contract(Mock1InchV3)
  runIf(trueLender2.isInitialized().not(), () => {
    trueLender2.initialize(stkTruToken, poolFactory, trueRatingAgencyV2, oneInch)
  })
  const liquidator2 = proxy(contract(Liquidator2), () => {})
  const loanFactory2 = proxy(contract(LoanFactory2), 'initialize',
    [poolFactory, trueLender2, liquidator2],
  )
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
  if (!isMainnet) {
    trueLender2.setFee(deployParams['testnet'].LOAN_INTEREST_FEE)
  }
  runIf(poolFactory.isPool(trueFiPool).not(), () => {
    poolFactory.addLegacyPool(trueFiPool)
  })
})
