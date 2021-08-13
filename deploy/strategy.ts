import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  CrvPriceOracle,
  CurveYearnStrategy,
  MockCrvPriceOracle,
  MockStrategy,
  MockTrueUSD,
  OwnedUpgradeabilityProxy,
  PoolFactory,
  TestUSDCToken,
  TestUSDTToken,
} from '../build/artifacts'

const TUSD = '0x0000000000085d4780B73119b644AE5ecd22b376'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const CURVE_GAUGE = '0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1'
const CURVE_POOL = '0xbbc81d23ea2c3ec7e56d39296f0cbb648873a5d3'
const CURVE_MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'
const ONE_INCH_EXCHANGE = '0x11111112542d85b3ef69ae05771c2dccff4faa26'
const MAX_PRICE_SLIPPAGE = 75

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

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
  const poolFactory = proxy(contract(PoolFactory), () => {})
  const tusd_TrueFiPool2 = poolFactory.pool(tusd)
  const usdc_TrueFiPool2 = poolFactory.pool(usdc)
  const usdt_TrueFiPool2 = poolFactory.pool(usdt)

  // New contract impls
  const tusd_CurveYearnStrategy_impl = contract('tusd_CurveYearnStrategy', CurveYearnStrategy)
  const usdc_CurveYearnStrategy_impl = contract('usdc_CurveYearnStrategy', CurveYearnStrategy)
  const usdt_CurveYearnStrategy_impl = contract('usdt_CurveYearnStrategy', CurveYearnStrategy)

  // New contract proxies
  const tusd_CurveYearnStrategy = proxy(tusd_CurveYearnStrategy_impl, () => {})
  const usdc_CurveYearnStrategy = proxy(usdc_CurveYearnStrategy_impl, () => {})
  const usdt_CurveYearnStrategy = proxy(usdt_CurveYearnStrategy_impl, () => {})

  // New bare contracts
  const crvPriceOracle = isMainnet
    ? contract(CrvPriceOracle)
    : contract(MockCrvPriceOracle)
  const tusd_MockStrategy = contract('tusd_MockStrategy', MockStrategy, [tusd, tusd_TrueFiPool2])
  const usdc_MockStrategy = contract('usdc_MockStrategy', MockStrategy, [usdc, usdc_TrueFiPool2])
  const usdt_MockStrategy = contract('usdt_MockStrategy', MockStrategy, [usdt, usdt_TrueFiPool2])

  // Contract initialization
  runIf(tusd_CurveYearnStrategy.isInitialized().not(), () => {
    tusd_CurveYearnStrategy.initialize(tusd_TrueFiPool2, CURVE_POOL, CURVE_GAUGE, CURVE_MINTER, ONE_INCH_EXCHANGE, crvPriceOracle, MAX_PRICE_SLIPPAGE, 3)
  })
  runIf(usdc_CurveYearnStrategy.isInitialized().not(), () => {
    usdc_CurveYearnStrategy.initialize(usdc_TrueFiPool2, CURVE_POOL, CURVE_GAUGE, CURVE_MINTER, ONE_INCH_EXCHANGE, crvPriceOracle, MAX_PRICE_SLIPPAGE, 1)
  })
  runIf(usdt_CurveYearnStrategy.isInitialized().not(), () => {
    usdt_CurveYearnStrategy.initialize(usdt_TrueFiPool2, CURVE_POOL, CURVE_GAUGE, CURVE_MINTER, ONE_INCH_EXCHANGE, crvPriceOracle, MAX_PRICE_SLIPPAGE, 2)
  })
  const tusd_Strategy = isMainnet
    ? tusd_CurveYearnStrategy
    : tusd_MockStrategy
  const usdc_Strategy = isMainnet
    ? usdc_CurveYearnStrategy
    : usdc_MockStrategy
  const usdt_Strategy = isMainnet
    ? usdt_CurveYearnStrategy
    : usdt_MockStrategy
  // runIf(tusd_TrueFiPool2.strategy().equals(tusd_Strategy).not(), () => {
  //   tusd_TrueFiPool2.switchStrategy(tusd_Strategy)
  // })
  // runIf(usdc_TrueFiPool2.strategy().equals(usdc_Strategy).not(), () => {
  //   usdc_TrueFiPool2.switchStrategy(usdc_Strategy)
  // })
  // runIf(usdt_TrueFiPool2.strategy().equals(usdt_Strategy).not(), () => {
  //   usdt_TrueFiPool2.switchStrategy(usdt_Strategy)
  // })
})
