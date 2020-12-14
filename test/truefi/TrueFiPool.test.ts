import { expect } from 'chai'
import { constants, Wallet, BigNumber } from 'ethers'
import { parseEth } from 'utils/parseEth'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'

import { toTrustToken } from 'scripts/utils'

import {
  beforeEachWithFixture,
  expectCloseTo,
  timeTravel,
} from 'utils'

import {
  MockErc20TokenFactory,
  MockErc20Token,
  TrueFiPoolFactory,
  TrueFiPool,
  MockCurvePool,
  MockCurvePoolFactory,
  TrueLender,
  TrueLenderFactory,
  LoanTokenFactory,
  LoanToken,
  TrueRatingAgencyJson,
  ICurveGaugeJson,
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
    await token.mint(owner.address, parseEth(1e7))
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
      await token.approve(pool.address, parseEth(1))
      await pool.join(parseEth(1))
      expect(await pool.poolValue()).to.equal(excludeFee(parseEth(1)))
    })

    it('price of loan tokens is added to pool value after loans were given', async () => {
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1e6))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.fund(loan2.address)
      expectCloseTo(await pool.poolValue(), excludeFee(parseEth(9e6).add(parseEth(105e4))))
    })

    it('loan tokens + tusd + curve liquidity tokens', async () => {
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1e6))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.fund(loan2.address)
      await pool.flush(excludeFee(parseEth(5e6)), 0)
      await curvePool.set_withdraw_price(parseEth(2))
      expectCloseTo(await pool.poolValue(), excludeFee(parseEth(4e6).add(parseEth(105e4).add(parseEth(1e7)))))
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
      await token.mint(borrower.address, parseEth(1e6))
      await token.connect(borrower).approve(pool.address, parseEth(1e6))
    })

    it('adds fee to claimable fees', async () => {
      expect(await pool.claimableFees()).to.equal(parseEth(25000))
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await pool.balanceOf(owner.address)).to.equal(excludeFee(parseEth(1e7)))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1e6))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const totalSupply = await pool.totalSupply()
      const poolValue = await pool.poolValue()
      await pool.connect(borrower).join(parseEth(1e6))
      expectCloseTo(await pool.balanceOf(borrower.address), totalSupply.mul(excludeFee(parseEth(1e6))).div(poolValue))
    })

    it('returns a basket of tokens on exit', async () => {
      const loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
      await lender.allow(owner.address, true)
      await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1e6))
      await lender.fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 180)
      const loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 2500)
      await lender.fund(loan2.address)

      await pool.exit(excludeFee(parseEth(5e6)))
      expect(await token.balanceOf(owner.address)).to.equal(excludeFee(parseEth(1e7)).sub(parseEth(2e6)).div(2))
      expect(await loan1.balanceOf(owner.address)).to.equal(parseEth(55e4))
      expect(await loan2.balanceOf(owner.address)).to.equal(parseEth(625e3))
    })

    describe('two stakers', () => {
      let loan1: LoanToken, loan2: LoanToken
      beforeEach(async () => {
        loan1 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 1000)
        await lender.allow(owner.address, true)
        await mockRatingAgency.mock.getResults.returns(0, 0, toTrustToken(1e6))
        await lender.fund(loan1.address)
        await timeTravel(provider, dayInSeconds * 180)
        // PoolValue is 10.05M USD at the moment
        // After join, owner has around 91% of shares
        await pool.connect(borrower).join(parseEth(1e6))
        loan2 = await new LoanTokenFactory(owner).deploy(token.address, borrower.address, lender.address, parseEth(1e6), dayInSeconds * 360, 2500)
        await lender.fund(loan2.address)
      })

      it('returns a basket of tokens on exit, two stakers', async () => {
        await pool.exit(excludeFee(parseEth(5e6)))
        expectCloseTo(await token.balanceOf(owner.address), parseEth(4080259)) // 91% of 1/2(9M - fee)
        expectCloseTo(await loan1.balanceOf(owner.address), parseEth(500226)) // 91% of 550K
        expectCloseTo(await loan2.balanceOf(owner.address), parseEth(568439)) // 91% of 625K
      })

      it('erases all tokens after all stakers exit', async () => {
        await pool.exit(excludeFee(parseEth(5e6)))
        await pool.exit(excludeFee(parseEth(5e6)))
        await pool.connect(borrower).exit(await pool.balanceOf(borrower.address))

        expect(await token.balanceOf(pool.address)).to.equal(await pool.claimableFees())
        expect(await loan1.balanceOf(pool.address)).to.equal(0)
        expect(await loan2.balanceOf(pool.address)).to.equal(0)

        expectCloseTo(await token.balanceOf(owner.address), parseEth(8160518)) // 91% of 9M - fee
        expectCloseTo(await loan1.balanceOf(owner.address), parseEth(1000452)) // 91% of 1.1M
        expectCloseTo(await loan2.balanceOf(owner.address), parseEth(1136878)) // 91% of 1.25M

        expectCloseTo(await token.balanceOf(borrower.address), parseEth(811981)) // 9% of 9M - fee
        expectCloseTo(await loan1.balanceOf(borrower.address), parseEth(99548)) // 9% of 1.1M
        expectCloseTo(await loan2.balanceOf(borrower.address), parseEth(113122)) // 9% of 1.25M
      })
    })
  })

  describe('flush', () => {
    beforeEach(async () => {
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
    })

    it('deposits given amount to curve', async () => {
      await pool.flush(parseEth(100), 123)
      expect('add_liquidity').to.be.calledOnContractWith(curvePool, [[0, 0, 0, parseEth(100)], 123])
    })

    it('reverts if not called by owner', async () => {
      await expect(pool.connect(borrower).flush(1, 0)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if flushing more than tUSD balance', async () => {
      await expect(pool.flush(parseEth(1e7 + 1), 0)).to.be.revertedWith('TrueFiPool: Insufficient currency balance')
    })

    it('deposits liquidity tokens in curve gauge', async () => {
      await expect('deposit').to.be.calledOnContractWith(mockCurveGauge, [parseEth(100)])
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      await curveToken.mint(pool.address, parseEth(1000))
      await token.mint(curvePool.address, parseEth(1000))
    })

    it('withdraws given amount from curve', async () => {
      await pool.pull(parseEth(100), 123)
      expect('remove_liquidity_one_coin').to.be.calledOnContractWith(curvePool, [parseEth(100), 3, 123, false])
    })

    it('reverts if not called by owner', async () => {
      await expect(pool.connect(borrower).pull(1, 0)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if flushing more than curve balance', async () => {
      await expect(pool.pull(parseEth(1001), 0)).to.be.revertedWith('TrueFiPool: Insufficient Curve liquidity balance')
    })
  })

  describe('borrow-repay', () => {
    let pool2: TrueFiPool

    beforeEach(async () => {
      pool2 = await new TrueFiPoolFactory(owner).deploy()
      await pool2.initialize(curvePool.address, mockCurveGauge.address, token.address, borrower.address, constants.AddressZero)
      await token.approve(pool2.address, parseEth(1e7))
      await pool2.join(parseEth(1e7))
      await pool2.flush(excludeFee(parseEth(5e6)), 0)
    })

    it('reverts if borrower is not a lender', async () => {
      await expect(pool2.borrow(parseEth(1001), parseEth(1001))).to.be.revertedWith('TrueFiPool: Only lender can borrow or repay')
    })

    it('reverts if repayer is not a lender', async () => {
      await pool2.connect(borrower).borrow(parseEth(1001), parseEth(1001))
      await expect(pool2.repay(parseEth(1001)))
        .to.be.revertedWith('TrueFiPool: Only lender can borrow or repay')
    })

    it('when borrowing less than trueCurrency balance, uses the balance', async () => {
      provider.clearCallHistory()
      const borrowedAmount = excludeFee(parseEth(5e6))
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
      await token.mint(curvePool.address, parseEth(2e6))
      await curvePool.set_withdraw_price(parseEth(1.5))
      await pool2.connect(borrower).borrow(parseEth(6e6), parseEth(6e6))
      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(6e6))
    })

    it('adds fee to claimableFees and borrows less if fee is not 0', async () => {
      const borrowedAmount = excludeFee(parseEth(5e6))
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
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
    })

    it('transfers claimable fees to address', async () => {
      await pool.collectFees(beneficiary)
      expect(await token.balanceOf(beneficiary)).to.equal(parseEth(25000))
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

    it('reverts when JoiningFee set to more than 100%', async () => {
      await expect(pool.setJoiningFee(10100))
        .to.be.revertedWith('TrueFiPool: Fee cannot exceed transaction value')
    })
  })
})
