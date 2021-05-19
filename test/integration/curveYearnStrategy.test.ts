import { CONTRACTS_OWNER, ETHER_HOLDER, forkChain } from './suite'
import {
  CrvPriceOracleFactory,
  CurveYearnStrategy,
  CurveYearnStrategyFactory,
  ImplementationReferenceFactory,
  PoolFactoryFactory,
  TrueFiPool2,
  TrueFiPool2Factory,
} from 'contracts'
import { setupDeploy } from 'scripts/utils'
import { Erc20Factory } from 'contracts/types/Erc20Factory'
import { Erc20 } from 'contracts/types/Erc20'
import { utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { DAY, expectScaledCloseTo, timeTravel } from 'utils'
import fetch from 'node-fetch'

use(solidity)

describe('Curve Yearn Pool Strategy', () => {
  const USDC_HOLDER = '0x55fe002aeff02f77364de339a1292923a15844b8'
  const TRU_ADDRESS = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [CONTRACTS_OWNER, USDC_HOLDER, ETHER_HOLDER])
  const owner = provider.getSigner(CONTRACTS_OWNER)
  const holder = provider.getSigner(USDC_HOLDER)
  const deployContract = setupDeploy(owner)
  const amount = utils.parseUnits('10000', 8)

  const GAUGE = '0xfa712ee4788c042e2b7bb55e6cb8ec569c4530c1'
  const CURVE_POOL = '0xbbc81d23ea2c3ec7e56d39296f0cbb648873a5d3'
  const MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'
  const ONE_INCH = '0x11111112542d85b3ef69ae05771c2dccff4faa26'
  const CRV = '0xD533a949740bb3306d119CC777fa900bA034cd52'

  let usdc: Erc20
  let pool: TrueFiPool2
  let strategy: CurveYearnStrategy

  beforeEach(async () => {
    await provider.getSigner(ETHER_HOLDER).sendTransaction({
      value: utils.parseEther('1000'),
      to: CONTRACTS_OWNER,
    })
    usdc = Erc20Factory.connect(USDC_ADDRESS, owner)
    const poolFactory = await deployContract(PoolFactoryFactory)
    const poolImplementation = await deployContract(TrueFiPool2Factory)
    const implementationReference = await deployContract(ImplementationReferenceFactory, poolImplementation.address)
    await poolFactory.initialize(implementationReference.address, TRU_ADDRESS)
    await poolFactory.whitelist(USDC_ADDRESS, true)
    await poolFactory.createPool(USDC_ADDRESS)

    pool = poolImplementation.attach(await poolFactory.pool(USDC_ADDRESS))

    await usdc.connect(holder).approve(pool.address, amount)
    await pool.connect(holder).join(amount)

    strategy = await new CurveYearnStrategyFactory(owner).deploy()
    const oracle = await deployContract(CrvPriceOracleFactory)

    await strategy.initialize(pool.address, CURVE_POOL, GAUGE, MINTER, ONE_INCH, oracle.address, 1)
    await pool.switchStrategy(strategy.address)
  })

  it('Flush and pool', async () => {
    await pool.flush(amount)
    await pool.pull(amount.div(2))
  })

  it('Withdraw all by switching strategy', async () => {
    await pool.flush(amount)
    await pool.switchStrategy(AddressZero)
    expect(await usdc.balanceOf(pool.address)).to.be.gte(amount.mul(999).div(1000)) // Curve fees
  })

  it('Mine CRV on Curve gauge and sell on 1Inch, CRV is not part of value', async () => {
    await pool.flush(amount)
    await timeTravel(provider, DAY * 10)

    const valueBefore = await strategy.value()
    expect(await strategy.crvValue()).to.equal(0)
    await strategy.collectCrv()
    expect((await strategy.value()).sub(valueBefore)).to.be.lt(await strategy.crvValue())
    expectScaledCloseTo(await strategy.value(), valueBefore)
    expect(await strategy.crvValue()).to.be.gt(0)

    const crvBalance = await strategy.crvBalance()
    const dataUrl = `https://api.1inch.exchange/v3.0/1/swap?disableEstimate=true&protocols=WETH,CURVE,BALANCER,UNISWAP_V2,SUSHI,ZRX&allowPartialFill=false&fromTokenAddress=${CRV}&toTokenAddress=${USDC_ADDRESS}&amount=${crvBalance.toString()}&fromAddress=${strategy.address}&destReceiver=${pool.address}&slippage=2`
    const body = await (await fetch(dataUrl)).json()
    const data = body.tx.data
    await strategy.sellCrv(data)
    expect(await usdc.balanceOf(pool.address)).to.be.gt(0)
    expect(await strategy.crvBalance()).to.equal(0)
  })

  it('value grows with time', async () => {
    await pool.flush(amount)
    const valueBefore = await strategy.value()
    await timeTravel(provider, DAY * 10)
    expect(await strategy.value()).to.be.gt(valueBefore)
  })
})
