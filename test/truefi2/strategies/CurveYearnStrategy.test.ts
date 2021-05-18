import { expect, use } from 'chai'
import { beforeEachWithFixture, parseEth } from 'utils'
import {
  MockCrvPriceOracle__factory,
  MockCurvePool,
  MockCurvePool__factory,
  MockErc20Token,
  MockErc20Token__factory,
  TestCurveStrategy,
  TestCurveStrategy__factory,
} from 'contracts'
import {
  ICurveGaugeJson,
  ICurveMinterJson,
} from 'build'
import { deployMockContract, MockContract, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('CurveYearnStrategy', () => {
  const amount = parseEth(1e7)
  let token: MockErc20Token
  let strategy: TestCurveStrategy
  let owner: Wallet, pool: Wallet
  let curvePool: MockCurvePool
  let mockCurveGauge: MockContract

  beforeEachWithFixture(async (wallets) => {
    ([owner, pool] = wallets)
    token = await new MockErc20Token__factory(owner).deploy()
    await token.mint(pool.address, amount)
    curvePool = await new MockCurvePool__factory(owner).deploy()
    await curvePool.initialize(token.address)
    mockCurveGauge = await deployMockContract(owner, ICurveGaugeJson.abi)
    const mockCrv = await new MockErc20Token__factory(owner).deploy()
    const mockMinter = await deployMockContract(owner, ICurveMinterJson.abi)
    await mockCurveGauge.mock.deposit.returns()
    await mockCurveGauge.mock.withdraw.returns()
    await mockCurveGauge.mock.balanceOf.returns(0)
    await mockCurveGauge.mock.minter.returns(mockMinter.address)
    await mockMinter.mock.token.returns(mockCrv.address)
    const crvOracle = await new MockCrvPriceOracle__factory(owner).deploy()

    strategy = await new TestCurveStrategy__factory(owner).deploy()
    await strategy.testInitialize(
      token.address,
      pool.address,
      curvePool.address,
      mockCurveGauge.address,
      mockMinter.address,
      AddressZero,
      crvOracle.address,
      3,
    )
  })

  describe('deposit', () => {
    beforeEach(async () => {
      await token.connect(pool).approve(strategy.address, amount)
      await curvePool.set_withdraw_price(parseEth(2))
    })

    it('calls add_liquidity with correct amounts and minAmount as 99.9% of theoretical', async () => {
      await strategy.connect(pool).deposit(amount)
      expect('add_liquidity').to.be.calledOnContractWith(curvePool, [[0, 0, 0, amount], amount.div(2).mul(999).div(1000)])
    })

    it('puts received tokens into gauge', async () => {
      await strategy.connect(pool).deposit(amount)
      expect('deposit').to.be.calledOnContractWith(mockCurveGauge, [amount.div(2)])
    })

    it('value grows after deposit', async () => {
      const valBefore = await strategy.value()
      await strategy.connect(pool).deposit(amount)
      const valAfter = await strategy.value()
      expect(valAfter.sub(valBefore)).to.equal(amount)
    })

    it('can only be called by the pool', async () => {
      await expect(strategy.deposit(amount)).to.be.revertedWith('CurveYearnStrategy: Can only be called by pool')
    })
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await token.connect(pool).approve(strategy.address, amount)
      await curvePool.set_withdraw_price(parseEth(2))
      await strategy.connect(pool).deposit(amount)
    })

    it('withdraws funds from Curve and transfers to the pool', async () => {
      await strategy.connect(pool).withdraw(amount.div(2))
      expect(await token.balanceOf(pool.address)).to.be.gte(amount.div(2))
    })

    it('withdraws from cure a bit more then theoretical value because of Curve\'s errors', async () => {
      await strategy.connect(pool).withdraw(amount.div(2))
      const curveLpAmount = amount
        .div(2) // minAmount
        .div(2) // convert to CurveLP
        .mul(1005).div(1000) // add 0.5%
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curvePool, [curveLpAmount, 3, amount.div(2), false])
    })

    it('if curve LP amount is less than 0.5% below balance, withdraws all available balance', async () => {
      await strategy.connect(pool).withdraw(amount.sub(2))
      const curveLpAmount = amount.div(2)
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curvePool, [curveLpAmount, 3, amount.sub(2), false])
    })

    it('value drops after deposit', async () => {
      const valBefore = await strategy.value()
      await strategy.connect(pool).withdraw(amount.div(2))
      const valAfter = await strategy.value()
      const expectedChange = amount
        .div(2) // minAmount
        .mul(1005).div(1000) // add 0.5%
      expect(valBefore.sub(valAfter)).to.equal(expectedChange)
    })

    it('can only be called by the pool', async () => {
      await expect(strategy.withdraw(amount.div(2))).to.be.revertedWith('CurveYearnStrategy: Can only be called by pool')
    })

    it('reverts if trying to withdraw more than the balance', async () => {
      await expect(strategy.connect(pool).withdraw(amount.add(2)))
        .to.be.revertedWith('CurveYearnStrategy: Not enough Curve liquidity tokens in pool to cover borrow')
    })
  })

  describe('withdrawAll', () => {
    beforeEach(async () => {
      await token.connect(pool).approve(strategy.address, amount)
      await curvePool.set_withdraw_price(parseEth(2))
      await strategy.connect(pool).deposit(amount)
    })

    it('removes liquidity from Curve with all available LP tokens', async () => {
      await strategy.connect(pool).withdrawAll()
      expect(await token.balanceOf(pool.address)).to.equal(amount)
    })

    it('value becomes 0', async () => {
      await strategy.connect(pool).withdrawAll()
      expect(await strategy.value()).to.equal(0)
    })

    it('can only be called by the pool', async () => {
      await expect(strategy.withdrawAll()).to.be.revertedWith('CurveYearnStrategy: Can only be called by pool')
    })
  })
})
