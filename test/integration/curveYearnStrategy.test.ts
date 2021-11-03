import { CONTRACTS_OWNER, ETHER_HOLDER, forkChain } from './suite'
import {
  CrvPriceOracle__factory,
  CurveYearnStrategy,
  CurveYearnStrategy__factory,
  ImplementationReference__factory,
  PoolFactory__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  Erc20,
  Erc20__factory,
} from 'contracts'
import { setupDeploy } from 'scripts/utils'
import { utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { DAY, expectScaledCloseTo, timeTravel } from 'utils'
import { mock1Inch_CYS } from './data'
import { JsonRpcSigner, Web3Provider } from '@ethersproject/providers'

use(solidity)

describe('Curve Yearn Pool Strategy', () => {
  const USDC_HOLDER = '0x55fe002aeff02f77364de339a1292923a15844b8'
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const amount = utils.parseUnits('10000', 8)

  const GAUGE = '0xfa712ee4788c042e2b7bb55e6cb8ec569c4530c1'
  const CURVE_POOL = '0xbbc81d23ea2c3ec7e56d39296f0cbb648873a5d3'
  const MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'
  const ONE_INCH = '0x11111112542d85b3ef69ae05771c2dccff4faa26'

  let provider: Web3Provider
  let owner: JsonRpcSigner
  let holder: JsonRpcSigner
  let deployContract: any

  let usdc: Erc20
  let pool: TrueFiPool2
  let strategy: CurveYearnStrategy

  // Some requests to forked network are randomly failing (possibly some Ganache issue, so we retry them 3 times)
  const retry = async (call: () => void) => {
    let i = 3
    while (i-- > 0) {
      try {
        await call()
        return
        // eslint-disable-next-line no-empty
      } catch { }
    }
    throw new Error('Function has failed 3 times')
  }

  beforeEach(async () => {
    provider = forkChain([CONTRACTS_OWNER, USDC_HOLDER, ETHER_HOLDER], 13287798)
    owner = provider.getSigner(CONTRACTS_OWNER)
    holder = provider.getSigner(USDC_HOLDER)
    deployContract = setupDeploy(owner)

    await provider.getSigner(ETHER_HOLDER).sendTransaction({
      value: utils.parseEther('1000'),
      to: CONTRACTS_OWNER,
    })
    usdc = Erc20__factory.connect(USDC_ADDRESS, owner)
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    const implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    await poolFactory.initialize(implementationReference.address, AddressZero, AddressZero, AddressZero)
    await poolFactory.allowToken(USDC_ADDRESS, true)
    await poolFactory.createPool(USDC_ADDRESS)

    pool = poolImplementation.attach(await poolFactory.pool(USDC_ADDRESS))

    await usdc.connect(holder).approve(pool.address, amount)
    await pool.connect(holder).join(amount)

    strategy = await new CurveYearnStrategy__factory(owner).deploy()
    const oracle = await deployContract(CrvPriceOracle__factory)

    await strategy.initialize(pool.address, CURVE_POOL, GAUGE, MINTER, ONE_INCH, oracle.address, 75, 1)
    await pool.switchStrategy(strategy.address)
  })

  it('Flush and pool', async () => {
    await retry(() => pool.flush(amount))
    await retry(() => pool.pull(amount.div(2)))
  }).timeout(10000000)

  it('Withdraw all by switching strategy', async () => {
    await retry(() => pool.flush(amount))
    await retry(() => pool.switchStrategy(AddressZero))
    expect(await usdc.balanceOf(pool.address)).to.be.gte(amount.mul(999).div(1000)) // Curve fees
  }).timeout(10000000)

  it('Mine CRV on Curve gauge and sell on 1Inch, CRV is not part of value', async () => {
    await retry(() => pool.flush(amount))
    await timeTravel(provider, DAY * 10)

    const valueBefore = await strategy.value()
    expect(await strategy.crvValue()).to.equal(0)
    await strategy.collectCrv()
    expect((await strategy.value()).sub(valueBefore)).to.be.lt(await strategy.crvValue())
    expectScaledCloseTo(await strategy.value(), valueBefore)
    expect(await strategy.crvValue()).to.be.gt(0)

    const crvBalance = await strategy.crvBalance()
    const data = mock1Inch_CYS(crvBalance, pool.address)

    await strategy.sellCrv(data)
    expect(await usdc.balanceOf(pool.address)).to.be.gt(0)
    expect(await strategy.crvBalance()).to.equal(0)
  }).timeout(10000000)

  it('value grows with time', async () => {
    await retry(() => pool.flush(amount))
    const valueBefore = await strategy.value()
    await timeTravel(provider, DAY * 10)
    expect(await strategy.value()).to.be.gt(valueBefore)
  }).timeout(10000000)
})
