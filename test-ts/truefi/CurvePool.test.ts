import { expect } from 'chai'
import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { constants, Wallet } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { MockErc20TokenFactory } from '../../build/types/MockErc20TokenFactory'
import { MockErc20Token } from '../../build/types/MockErc20Token'
import { CurvePoolFactory } from '../../build/types/CurvePoolFactory'
import { CurvePool } from '../../build/types/CurvePool'
import { MockCurvePool } from '../../build/types/MockCurvePool'
import { MockCurvePoolFactory } from '../../build/types/MockCurvePoolFactory'
import { TrueLender } from '../../build/types/TrueLender'
import { TrueLenderFactory } from '../../build/types/TrueLenderFactory'
import TrueRatingAgency from '../../build/TrueRatingAgency.json'
import ICurveGauge from '../../build/ICurveGauge.json'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { toTrustToken } from '../../scripts/utils'
import { timeTravel } from '../utils/timeTravel'
import { expectCloseTo } from '../utils/expectCloseTo'
import { LoanToken } from '../../build/types/LoanToken'

describe('CurvePool', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let token: MockErc20Token
  let curveToken: MockErc20Token
  let curve: MockCurvePool
  let pool: CurvePool
  let lender: TrueLender
  let mockRatingAgency: MockContract
  let mockCurveGauge: MockContract

  const dayInSeconds = 60 * 60 * 24

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    token = await new MockErc20TokenFactory(owner).deploy()
    await token.mint(owner.address, parseEther('10000000'))
    curve = await new MockCurvePoolFactory(owner).deploy()
    await curve.initialize(token.address)
    curveToken = MockErc20TokenFactory.connect(await curve.token(), owner)
    pool = await new CurvePoolFactory(owner).deploy()
    mockRatingAgency = await deployMockContract(owner, TrueRatingAgency.abi)
    mockCurveGauge = await deployMockContract(owner, ICurveGauge.abi)
    await mockCurveGauge.mock.deposit.returns()
    await mockCurveGauge.mock.withdraw.returns()
    await mockCurveGauge.mock.balanceOf.returns(0)
    lender = await new TrueLenderFactory(owner).deploy()
    await pool.initialize(curve.address, mockCurveGauge.address, token.address, lender.address)
    await lender.initialize(pool.address, mockRatingAgency.address)
    provider = _provider
  })

  describe('initializer', () => {
    it('sets infinite allowances to curve', async () => {
      expect(await token.allowance(pool.address, curve.address)).to.equal(constants.MaxUint256)
      expect(await curveToken.allowance(pool.address, curve.address)).to.equal(constants.MaxUint256)
    })

    it('sets erc20 params', async () => {
      expect(await pool.name()).to.equal('CurveTUSDPool')
      expect(await pool.symbol()).to.equal('crvTUSD')
      expect(await pool.decimals()).to.equal(18)
    })
  })

  describe('poolValue', () => {
    it('equals balance of tusd when no other tokens on balance', async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
      expect(await pool.poolValue()).to.equal(parseEther('1'))
    })

    it('price of loan tokens is added to pool value after loans were given', async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.fund(loan2.address)
      expectCloseTo(await pool.poolValue(), parseEther('9000000').add(parseEther('1050000')))
    })

    it('loan tokens + tusd + curve liquidity tokens', async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.fund(loan2.address)
      await pool.flush(parseEther('5000000'), 0)
      await curve.set_withdraw_price(parseEther('2'))
      expectCloseTo(await pool.poolValue(), parseEther('4000000').add(parseEther('1050000').add(parseEther('10000000'))))
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      await token.mint(borrower.address, parseEther('1000000'))
      await token.connect(borrower).approve(pool.address, parseEther('1000000'))
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await pool.balanceOf(owner.address)).to.equal(parseEther('10000000'))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const totalSupply = parseEther('10000000')
      const poolValue = await pool.poolValue()
      await pool.connect(borrower).join(parseEther('1000000'))
      expectCloseTo(await pool.balanceOf(borrower.address), totalSupply.mul(parseEther('1000000')).div(poolValue))
    })

    it('returns a basket of tokens on exit', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
      await lender.fund(loan2.address)

      await pool.exit(parseEther('5000000'))
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('4000000'))
      expect(await loan1.balanceOf(owner.address)).to.equal(parseEther('550000'))
      expect(await loan2.balanceOf(owner.address)).to.equal(parseEther('625000'))
    })

    describe('two stakers', () => {
      let loan1: LoanToken, loan2: LoanToken
      beforeEach(async () => {
        loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
        await lender.allow(owner.address, true)
        await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
        await lender.fund(loan1.address)
        await timeTravel(provider, dayInSeconds * 180)
        // PoolValue is 1.05M USD at the moment
        // After join, owner has around 91% of shares
        await pool.connect(borrower).join(parseEther('1000000'))
        loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
        await lender.fund(loan2.address)
      })

      it('returns a basket of tokens on exit, two stakers', async () => {
        await pool.exit(parseEther('5000000'))
        expectCloseTo(await token.balanceOf(owner.address), parseEther('4092760')) // 91% of 4.5M
        expectCloseTo(await loan1.balanceOf(owner.address), parseEther('500226')) // 91% of 550K
        expectCloseTo(await loan2.balanceOf(owner.address), parseEther('568439')) // 91% of 625K
      })

      it('erases all tokens after all stakers exit', async () => {
        await pool.exit(parseEther('5000000'))
        await pool.exit(parseEther('5000000'))
        await pool.connect(borrower).exit(await pool.balanceOf(borrower.address))

        expect(await token.balanceOf(pool.address)).to.equal(0)
        expect(await loan1.balanceOf(pool.address)).to.equal(0)
        expect(await loan2.balanceOf(pool.address)).to.equal(0)

        expectCloseTo(await token.balanceOf(owner.address), parseEther('8185520')) // 91% of 9M
        expectCloseTo(await loan1.balanceOf(owner.address), parseEther('1000452')) // 91% of 1.1M
        expectCloseTo(await loan2.balanceOf(owner.address), parseEther('1136878')) // 91% of 1.25M

        expectCloseTo(await token.balanceOf(borrower.address), parseEther('814480')) // 9% of 9M
        expectCloseTo(await loan1.balanceOf(borrower.address), parseEther('99548')) // 9% of 1.1M
        expectCloseTo(await loan2.balanceOf(borrower.address), parseEther('113122')) // 9% of 1.25M
      })
    })
  })

  describe('flush', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
    })

    it('deposits given amount to curve', async () => {
      await pool.flush(parseEther('100'), 123)
      expect('add_liquidity').to.be.calledOnContractWith(curve, [[0, 0, 0, parseEther('100')], 123])
    })

    it('reverts if not called by owner', async () => {
      await expect(pool.connect(borrower).flush(1, 0)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if flushing more than tUSD balance', async () => {
      await expect(pool.flush(parseEther('10000001'), 0)).to.be.revertedWith('CurvePool: Insufficient currency balance')
    })

    it('deposits liquidity tokens in curve gauge', async () => {
      await expect('deposit').to.be.calledOnContractWith(mockCurveGauge, [parseEther('100')])
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      await curveToken.mint(pool.address, parseEther('1000'))
      await token.mint(curve.address, parseEther('1000'))
    })

    it('withdraws given amount from curve', async () => {
      await pool.pull(parseEther('100'), 123)
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curve, [parseEther('100'), 3, 123, false])
    })

    it('reverts if not called by owner', async () => {
      await expect(pool.connect(borrower).pull(1, 0)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if flushing more than curve balance', async () => {
      await expect(pool.pull(parseEther('1001'), 0)).to.be.revertedWith('CurvePool: Insufficient Curve liquidity balance')
    })

    it('withdraws liquidity tokens from curve gauge', async () => {
      await expect('withdraw').to.be.calledOnContractWith(mockCurveGauge, [parseEther('100')])
    })
  })

  describe('borrow-repay', () => {
    beforeEach(async () => {
      pool = await new CurvePoolFactory(owner).deploy()
      await pool.initialize(curve.address, mockCurveGauge.address, token.address, borrower.address)
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      await pool.flush(parseEther('5000000'), 0)
    })

    it('reverts if borrower is not a lender', async () => {
      await expect(pool.borrow(parseEther('1001'))).to.be.revertedWith('CurvePool: Only lender can borrow')
    })

    it('when borrowing less than trueCurrency balance, uses the balance', async () => {
      provider.clearCallHistory()
      await pool.connect(borrower).borrow(parseEther('5000000'))
      expect(await token.balanceOf(borrower.address)).to.equal(parseEther('5000000'))
      expect(await token.balanceOf(pool.address)).to.equal(0)
      expect('remove_liquidity_one_coin').to.be.not.calledOnContract(curve)

      await token.connect(borrower).approve(pool.address, parseEther('5000000'))
      await pool.connect(borrower).repay(parseEther('5000000'))
      expect(await token.balanceOf(borrower.address)).to.equal(0)
      expect(await token.balanceOf(pool.address)).to.equal(parseEther('5000000'))
    })

    it('when trueCurrency balance is not enough, withdraws from curve', async () => {
      await token.mint(curve.address, parseEther('2000000'))
      await curve.set_withdraw_price(parseEther('1.5'))
      await pool.connect(borrower).borrow(parseEther('6000000'))
      await expect('withdraw').to.be.calledOnContract(mockCurveGauge)
      expect(await token.balanceOf(borrower.address)).to.equal(parseEther('6000000'))
    })
  })
})
