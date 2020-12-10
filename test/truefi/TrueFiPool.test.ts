import { expect } from 'chai'
import { BigNumber, constants, Wallet } from 'ethers'
import { parseEther } from '@ethersproject/units'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'

import { toTrustToken } from 'scripts/utils'

import { beforeEachWithFixture, expectCloseTo, timeTravel } from 'utils'

import {
  ICurveGaugeJson,
  LoanToken,
  LoanTokenFactory,
  MockCurvePool,
  MockCurvePoolFactory,
  MockErc20Token,
  MockErc20TokenFactory,
  TrueFiPool,
  TrueFiPoolFactory,
  TrueLender,
  TrueLenderFactory,
  TrueRatingAgencyJson,
} from 'contracts'

describe('TrueFiPool', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let token: MockErc20Token
  let curveToken: MockErc20Token
  let curvePool: MockCurvePool
  let pool: TrueFiPool
  let lender: TrueLender
  let mockRatingAgency: MockContract
  let mockCurveGauge: MockContract

  const dayInSeconds = 60 * 60 * 24

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    token = await new MockErc20TokenFactory(owner).deploy()
    await token.mint(owner.address, parseEther('10000000'))
    curvePool = await new MockCurvePoolFactory(owner).deploy()
    await curvePool.initialize(token.address)
    curveToken = MockErc20TokenFactory.connect(await curvePool.token(), owner)
    pool = await new TrueFiPoolFactory(owner).deploy()
    mockRatingAgency = await deployMockContract(owner, TrueRatingAgencyJson.abi)
    mockCurveGauge = await deployMockContract(owner, ICurveGaugeJson.abi)
    await mockCurveGauge.mock.deposit.returns()
    await mockCurveGauge.mock.withdraw.returns()
    await mockCurveGauge.mock.balanceOf.returns(0)
    await mockCurveGauge.mock.minter.returns(constants.AddressZero)
    lender = await new TrueLenderFactory(owner).deploy()
    await pool.initialize(curvePool.address, mockCurveGauge.address, token.address, lender.address, constants.AddressZero)
    await pool.approveCurve()
    await lender.initialize(pool.address, mockRatingAgency.address)
    provider = _provider
  })

  describe('initializer', () => {
    it('sets infinite allowances to curve', async () => {
      expect(await token.allowance(pool.address, curvePool.address)).to.equal(constants.MaxUint256)
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(constants.MaxUint256)
    })

    it('sets erc20 params', async () => {
      expect(await pool.name()).to.equal('TrueFi LP')
      expect(await pool.symbol()).to.equal('TFI-LP')
      expect(await pool.decimals()).to.equal(18)
    })

    it('approves curve gauge', async () => {
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(constants.MaxUint256)
    })
  })

  const excludeFee = (amount: BigNumber) => amount.sub(amount.mul(25).div(10000))

  describe('poolValue', () => {
    it('equals balance of tusd when no other tokens on balance', async () => {
      await token.approve(pool.address, parseEther('1'))
      await pool.join(parseEther('1'))
      expect(await pool.poolValue()).to.equal(excludeFee(parseEther('1')))
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
      expectCloseTo(await pool.poolValue(), excludeFee(parseEther('9000000').add(parseEther('1050000'))))
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
      await pool.flush(excludeFee(parseEther('5000000')), 0)
      await curvePool.set_withdraw_price(parseEther('2'))
      expectCloseTo(await pool.poolValue(), excludeFee(parseEther('4000000').add(parseEther('1050000').add(parseEther('10000000')))))
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
      await token.mint(borrower.address, parseEther('1000000'))
      await token.connect(borrower).approve(pool.address, parseEther('1000000'))
    })

    it('adds fee to claimable fees', async () => {
      expect(await pool.claimableFees()).to.equal(parseEther('25000'))
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await pool.balanceOf(owner.address)).to.equal(excludeFee(parseEther('10000000')))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const totalSupply = await pool.totalSupply()
      const poolValue = await pool.poolValue()
      await pool.connect(borrower).join(parseEther('1000000'))
      expectCloseTo(await pool.balanceOf(borrower.address), totalSupply.mul(excludeFee(parseEther('1000000'))).div(poolValue))
    })

    it('returns a basket of tokens on exit', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1000000))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
      await lender.fund(loan2.address)

      await pool.exit(excludeFee(parseEther('5000000')))
      expect(await token.balanceOf(owner.address)).to.equal(excludeFee(parseEther('10000000')).sub(parseEther('2000000')).div(2))
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
        // PoolValue is 10.05M USD at the moment
        // After join, owner has around 91% of shares
        await pool.connect(borrower).join(parseEther('1000000'))
        loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, parseEther('1000000'), dayInSeconds * 360, 2500)
        await lender.fund(loan2.address)
      })

      it('returns a basket of tokens on exit, two stakers', async () => {
        await pool.exit(excludeFee(parseEther('5000000')))
        expectCloseTo(await token.balanceOf(owner.address), parseEther('4080259')) // 91% of 1/2(9M - fee)
        expectCloseTo(await loan1.balanceOf(owner.address), parseEther('500226')) // 91% of 550K
        expectCloseTo(await loan2.balanceOf(owner.address), parseEther('568439')) // 91% of 625K
      })

      it('erases all tokens after all stakers exit', async () => {
        await pool.exit(excludeFee(parseEther('5000000')))
        await pool.exit(excludeFee(parseEther('5000000')))
        await pool.connect(borrower).exit(await pool.balanceOf(borrower.address))

        expect(await token.balanceOf(pool.address)).to.equal(await pool.claimableFees())
        expect(await loan1.balanceOf(pool.address)).to.equal(0)
        expect(await loan2.balanceOf(pool.address)).to.equal(0)

        expectCloseTo(await token.balanceOf(owner.address), parseEther('8160518')) // 91% of 9M - fee
        expectCloseTo(await loan1.balanceOf(owner.address), parseEther('1000452')) // 91% of 1.1M
        expectCloseTo(await loan2.balanceOf(owner.address), parseEther('1136878')) // 91% of 1.25M

        expectCloseTo(await token.balanceOf(borrower.address), parseEther('811981')) // 9% of 9M - fee
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
      expect('add_liquidity').to.be.calledOnContractWith(curvePool, [[0, 0, 0, parseEther('100')], 123])
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
      await token.mint(curvePool.address, parseEther('1000'))
    })

    it('withdraws given amount from curve', async () => {
      await pool.pull(parseEther('100'), 123)
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curvePool, [parseEther('100'), 3, 123, false])
    })

    it('reverts if not called by owner', async () => {
      await expect(pool.connect(borrower).pull(1, 0)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if flushing more than curve balance', async () => {
      await expect(pool.pull(parseEther('1001'), 0)).to.be.revertedWith('CurvePool: Insufficient Curve liquidity balance')
    })
  })

  describe('borrow-repay', () => {
    let pool2: TrueFiPool

    beforeEach(async () => {
      pool2 = await new TrueFiPoolFactory(owner).deploy()
      await pool2.initialize(curvePool.address, mockCurveGauge.address, token.address, borrower.address, constants.AddressZero)
      await token.approve(pool2.address, parseEther('10000000'))
      await pool2.join(parseEther('10000000'))
      await pool2.flush(excludeFee(parseEther('5000000')), 0)
    })

    it('reverts if borrower is not a lender', async () => {
      await expect(pool2.borrow(parseEther('1001'), parseEther('1001'))).to.be.revertedWith('CurvePool: Only lender can borrow')
    })

    it('when borrowing less than trueCurrency balance, uses the balance', async () => {
      provider.clearCallHistory()
      const borrowedAmount = excludeFee(parseEther('5000000'))
      await pool2.connect(borrower).borrow(borrowedAmount, borrowedAmount)
      expect(await token.balanceOf(borrower.address)).to.equal(borrowedAmount)
      expect(await token.balanceOf(pool2.address)).to.equal(await pool2.claimableFees())
      expect('remove_liquidity_one_coin').to.be.not.calledOnContract(curvePool)

      await token.connect(borrower).approve(pool2.address, borrowedAmount)
      await pool2.connect(borrower).repay(borrowedAmount)
      expect(await token.balanceOf(borrower.address)).to.equal(0)
      expect(await token.balanceOf(pool2.address)).to.equal(borrowedAmount.add(await pool2.claimableFees()))
    })

    it('when trueCurrency balance is not enough, withdraws from curve', async () => {
      await token.mint(curvePool.address, parseEther('2000000'))
      await curvePool.set_withdraw_price(parseEther('1.5'))
      await pool2.connect(borrower).borrow(parseEther('6000000'), parseEther('6000000'))
      expect(await token.balanceOf(borrower.address)).to.equal(parseEther('6000000'))
    })

    it('adds fee to claimableFees and borrows less if fee is not 0', async () => {
      const borrowedAmount = excludeFee(parseEther('5000000'))
      const claimableFeesBefore = await pool2.claimableFees()
      const fee = borrowedAmount.mul(25).div(10000)
      await pool2.connect(borrower).borrow(borrowedAmount, borrowedAmount.sub(fee))
      const claimableFeesAfter = await pool2.claimableFees()
      expect(await token.balanceOf(borrower.address)).to.equal(borrowedAmount.sub(fee))
      expect(claimableFeesAfter.sub(claimableFeesBefore)).to.equal(fee)
      expect(await token.balanceOf(pool2.address)).to.equal(claimableFeesAfter)
    })
  })

  describe('collectFees', () => {
    const beneficiary = Wallet.createRandom().address

    beforeEach(async () => {
      await token.approve(pool.address, parseEther('10000000'))
      await pool.join(parseEther('10000000'))
    })

    it('transfers claimable fees to address', async () => {
      await pool.collectFees(beneficiary)
      expect(await token.balanceOf(beneficiary)).to.equal(parseEther('25000'))
    })

    it('sets claimableFees to 0', async () => {
      await pool.collectFees(beneficiary)
      expect(await pool.claimableFees()).to.equal(0)
      await expect(pool.collectFees(beneficiary)).to.not.emit(token, 'Transfer')
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).collectFees(beneficiary)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('setJoiningFee', () => {
    it('sets fee value', async () => {
      await pool.setJoiningFee(50)
      expect(await pool.joiningFee()).to.equal(50)
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).setJoiningFee(50)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('integrateAtPoint', () => {
    const calcOffchain = (x: number) => Math.floor(Math.log(x + 50) * 50000)
    it('calculates integral * 1e9', async () => {
      for (let i = 0; i < 100; i++) {
        expect(await pool.integrateAtPoint(i)).to.equal(calcOffchain(i))
      }
    })
  })

  describe('averageExitPenalty', () => {
    const testPenalty = async (from: number, to: number, result: number) => expect(await pool.averageExitPenalty(from, to)).to.equal(result)

    it('throws if from > to', async () => {
      expect(await pool.averageExitPenalty(10, 9)).to.be.revertedWith('CurvePool: To precedes from')
    });

    it('correctly calculates penalty when from = to', async () => {
      await testPenalty(0, 0, 1000)
      await testPenalty(1, 1, 990)
      await testPenalty(100, 100, 333)
      await testPenalty(10000, 10000, 0)
    })

    it('correctly calculates penalty when from+1=to', async () => {
      const testWithStep1 = async (from: number) => {
        const penalty = await pool.averageExitPenalty(from, from + 1)
        const expected = (await pool.averageExitPenalty(from, from)).add(await pool.averageExitPenalty(from + 1, from + 1)).div(2)
        expect(penalty.sub(expected).abs()).to.be.lte(1)
      }

      await testWithStep1(0)
      await testWithStep1(1)
      await testWithStep1(2)
      await testWithStep1(3)
      await testWithStep1(5)
      await testWithStep1(10)
      await testWithStep1(42)
      await testWithStep1(150)
      await testWithStep1(1000)
      await testWithStep1(10000 - 2)
    })

    it('correctly calculates penalty when from < to', async () => {
      // Checked with Wolfram Alpha
      await testPenalty(0, 12, 896)
      await testPenalty(1, 100, 544)
      await testPenalty(5, 10, 870)
      await testPenalty(15, 55, 599)
      await testPenalty(42, 420, 215)
      await testPenalty(100, 1000, 108)
      await testPenalty(9100, 10000, 5)
      await testPenalty(1000, 10000, 12)
    })
  })

  describe('liquidExit', () => {
    const amount = parseEther('10000000')
    beforeEach(async () => {
      await token.approve(pool.address, amount)
      await pool.join(amount)
    })

    it('burns pool tokens on exit', async () => {
      const supply = await pool.totalSupply()
      await pool.liquidExit(supply.div(2))
      expect(await pool.totalSupply()).to.equal(supply.div(2))
      await pool.liquidExit(supply.div(3))
      expect(await pool.totalSupply()).to.equal(supply.div(6))
    })

    it('all funds are liquid: transfers TUSD without penalty', async () => {
      await pool.liquidExit(await pool.balanceOf(owner.address))
      expect(await token.balanceOf(owner.address)).to.equal(excludeFee(amount))
    })

    it('all funds are liquid: transfers TUSD without penalty (half of stake)', async () => {
      await pool.liquidExit(amount.div(2))
      expect(await token.balanceOf(owner.address)).to.equal(amount.div(2))
    })

    it('after loan approved, applies a penalty', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, amount.div(3), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(10000000))
      await lender.fund(loan1.address)
      expect(await pool.liquidExitPenalty(amount.div(2))).to.equal(9990)
      await pool.liquidExit(amount.div(2), { gasLimit: 5000000 })
      expectCloseTo(await token.balanceOf(owner.address), (amount.div(2).mul(9990).div(10000)))
    })

    it('emits event', async () => {
      await expect(pool.liquidExit(amount.div(2))).to.emit(pool, 'Exited').withArgs(owner.address, amount.div(2))
    })
  })
})
