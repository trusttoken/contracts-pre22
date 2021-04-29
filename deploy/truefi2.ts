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

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'

  const trustToken = isMainnet ? timeProxy(contract('trustToken', TrustToken), () => {}) : timeProxy(contract('trustToken', TestTrustToken), () => {})
  const stkTruToken = proxy(contract(StkTruToken), () => {})
  const trueRatingAgencyV2 = proxy(contract(TrueRatingAgencyV2), () => {})

  const trueLender2 = proxy(contract(TrueLender2), () => {})

  const poolImplementation = contract(TrueFiPool2)
  const implementationReference = contract(ImplementationReference, [poolImplementation])
  const poolFactory = proxy(contract(PoolFactory), 'initialize', [implementationReference, trustToken, trueLender2])

  runIf(trueLender2.isInitialized().not(), () => trueLender2.initialize(stkTruToken, poolFactory, trueRatingAgencyV2, '0x11111112542d85b3ef69ae05771c2dccff4faa26'))
  const liquidator2 = proxy(contract(Liquidator2), () => {})
  const loanFactory2 = proxy(contract(LoanFactory2), 'initialize', [poolFactory, trueLender2, liquidator2])
  runIf(liquidator2.isInitialized().not(), () => liquidator2.initialize(stkTruToken, trustToken, loanFactory2))

  const usdc = contract('usdc', MockERC20Token)

  runIf(poolFactory.pool(usdc).equals(AddressZero), () => {
    poolFactory.whitelist(usdc, true)
    poolFactory.createPool(usdc)
  })
  const usdcPool = poolFactory.pool(usdc)

  runIf(trueLender2.feePool().equals(AddressZero), () => trueLender2.setFeePool(usdcPool))
  if (!isMainnet) {
    trueLender2.setFee(500)
  }

  const oldPool = isMainnet ? proxy(contract('trueFiPool', TrueFiPool), () => {}) : proxy(contract('trueFiPool', TestTrueFiPool), () => {})
  runIf(poolFactory.isPool(oldPool).not(), () => poolFactory.addLegacyPool(oldPool))
})
