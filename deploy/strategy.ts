import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import { CrvPriceOracle, CurveYearnStrategy, OwnedUpgradeabilityProxy, PoolFactory } from '../build/artifacts'

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const GAUGE = '0xfa712ee4788c042e2b7bb55e6cb8ec569c4530c1'
const CURVE_POOL = '0xbbc81d23ea2c3ec7e56d39296f0cbb648873a5d3'
const MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'
const ONE_INCH = '0x11111112542d85b3ef69ae05771c2dccff4faa26'

deploy({}, () => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  // const poolFactory = proxy(contract(PoolFactory), () => {})
  // const usdcPool = poolFactory.pool(USDC)
  // const usdtPool = poolFactory.pool(USDT)
  const usdcPool = '0xA991356d261fbaF194463aF6DF8f0464F8f1c742'
  const usdtPool = '0x6002b1dcB26E7B1AA797A17551C6F487923299d7'

  const usdc_CurveYearnStrategy = proxy(contract('usdc_CurveYearnStrategy', CurveYearnStrategy), () => {})
  const usdt_CurveYearnStrategy = proxy(contract('usdt_CurveYearnStrategy', CurveYearnStrategy), () => {})

  const oracle = contract(CrvPriceOracle)
  runIf(usdc_CurveYearnStrategy.isInitialized().not(), () => usdc_CurveYearnStrategy.initialize(usdcPool, CURVE_POOL, GAUGE, MINTER, ONE_INCH, oracle, 1))
  runIf(usdt_CurveYearnStrategy.isInitialized().not(), () => usdt_CurveYearnStrategy.initialize(usdtPool, CURVE_POOL, GAUGE, MINTER, ONE_INCH, oracle, 2))
})
