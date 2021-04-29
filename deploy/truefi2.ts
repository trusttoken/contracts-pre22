import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  ImplementationReference,
  Liquidator2,
  LoanFactory2,
  MockERC20Token,
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

const ONE_INCH_EXCHANGE = '0x11111112542d85b3ef69ae05771c2dccff4faa26'

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'

  const trustToken = isMainnet ? timeProxy(contract(TrustToken), () => {}) : timeProxy(contract(TestTrustToken), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const trueRatingAgencyV2 = proxy(contract(TrueRatingAgencyV2), () => {})

  const trueLender2 = proxy(contract(TrueLender2), () => {})

  const trueFiPool2 = contract(TrueFiPool2)
  const implementationReference = contract(ImplementationReference, [trueFiPool2])
  const poolFactory = proxy(contract(PoolFactory), 'initialize', [implementationReference, trustToken, trueLender2])

  runIf(trueLender2.isInitialized().not(), () => trueLender2.initialize(stkTruToken, poolFactory, trueRatingAgencyV2, ONE_INCH_EXCHANGE))
  const liquidator2 = proxy(contract(Liquidator2), () => {})
  const loanFactory2 = proxy(contract(LoanFactory2), 'initialize', [poolFactory, trueLender2, liquidator2])
  runIf(liquidator2.isInitialized().not(), () => liquidator2.initialize(stkTruToken, trustToken, loanFactory2))

  const usdc_MockERC20Token = contract('usdc_MockERC20Token', MockERC20Token)

  runIf(poolFactory.pool(usdc_MockERC20Token).equals(AddressZero), () => {
    poolFactory.whitelist(usdc_MockERC20Token, true)
    poolFactory.createPool(usdc_MockERC20Token)
  })
  const usdc_TrueFiPool2 = poolFactory.pool(usdc_MockERC20Token)

  runIf(trueLender2.feePool().equals(AddressZero), () => trueLender2.setFeePool(usdc_TrueFiPool2))
  if (!isMainnet) {
    trueLender2.setFee(500)
  }

  const legacy_TrueFiPool = isMainnet ? proxy(contract(TrueFiPool), () => {}) : proxy(contract(TestTrueFiPool), () => {})
  runIf(poolFactory.isPool(legacy_TrueFiPool).not(), () => poolFactory.addLegacyPool(legacy_TrueFiPool))
})
