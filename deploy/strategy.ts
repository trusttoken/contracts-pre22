import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import { CrvPriceOracle, CurveYearnStrategy, OwnedUpgradeabilityProxy, PoolFactory } from '../build/artifacts'

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const GAUGE = '0xfa712ee4788c042e2b7bb55e6cb8ec569c4530c1'
const CURVE_POOL = '0xbbc81d23ea2c3ec7e56d39296f0cbb648873a5d3'
const MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'
const ONE_INCH = '0x11111112542d85b3ef69ae05771c2dccff4faa26'

deploy({}, () => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  const poolFactory = proxy(contract(PoolFactory), () => {})

  const curveStrategy = proxy(contract(CurveYearnStrategy), () => {})

  const usdcPool = poolFactory.pool(USDC)

  const oracle = contract(CrvPriceOracle)
  runIf(curveStrategy.isInitialized().not(), () => curveStrategy.initialize(usdcPool, CURVE_POOL, GAUGE, MINTER, ONE_INCH, oracle, 1))
})
