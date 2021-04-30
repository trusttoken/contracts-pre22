import { expect, use } from 'chai'
import { BigNumber, constants, Wallet } from 'ethers'
import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'

import { beforeEachWithFixture, DAY, expectCloseTo, expectScaledCloseTo, parseEth, parseTRU, timeTravel } from 'utils'

import {
  ImplementationReference__factory,
  Liquidator2,
  Liquidator2__factory,
  LoanFactory2,
  LoanFactory2__factory,
  LoanToken,
  LoanToken__factory,
  LoanToken2__factory,
  MockCrvPriceOracle__factory,
  MockCurvePool,
  MockCurvePool__factory,
  MockErc20Token,
  MockErc20Token__factory,
  MockStakingPool,
  MockStakingPool__factory,
  PoolArbitrageTest__factory,
  PoolFactory__factory,
  TestTrueFiPool,
  TestTrueFiPool__factory,
  TrueFiPool2__factory,
  TrueLender,
  TrueLender2,
  TrueLender2__factory,
  TrueLender__factory,
  MockTrueFiPoolOracle__factory,
} from 'contracts'
import { ICurveGaugeJson, ICurveMinterJson, TrueRatingAgencyJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('TrueFiPool', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let token: MockErc20Token
  let trustToken: MockErc20Token
  let mockStakingPool: MockStakingPool
  let curveToken: MockErc20Token
  let curvePool: MockCurvePool
  let pool: TestTrueFiPool
  let lender: TrueLender
  let mockRatingAgency: MockContract
  let mockCrv: MockErc20Token
  let mockCurveGauge: MockContract

  const dayInSeconds = 60 * 60 * 24
  const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    token = await new MockErc20Token__factory(owner).deploy()
    await token.mint(owner.address, includeFee(parseEth(1e7)))
    trustToken = await new MockErc20Token__factory(owner).deploy()
    curvePool = await new MockCurvePool__factory(owner).deploy()
    await curvePool.initialize(token.address)
    curveToken = MockErc20Token__factory.connect(await curvePool.token(), owner)
    pool = await new TestTrueFiPool__factory(owner).deploy()
    mockStakingPool = await new MockStakingPool__factory(owner).deploy(pool.address)
    mockRatingAgency = await deployMockContract(owner, TrueRatingAgencyJson.abi)
    mockCurveGauge = await deployMockContract(owner, ICurveGaugeJson.abi)
    mockCrv = await new MockErc20Token__factory(owner).deploy()
    const mockMinter = await deployMockContract(owner, ICurveMinterJson.abi)
    await mockCurveGauge.mock.deposit.returns()
    await mockCurveGauge.mock.withdraw.returns()
    await mockCurveGauge.mock.balanceOf.returns(0)
    await mockCurveGauge.mock.minter.returns(mockMinter.address)
    await mockMinter.mock.token.returns(mockCrv.address)
    lender = await new TrueLender__factory(owner).deploy()
    const truOracle = await new MockTrueFiPoolOracle__factory(owner).deploy(token.address)
    const crvOracle = await new MockCrvPriceOracle__factory(owner).deploy()
    await pool.initialize(
      curvePool.address,
      mockCurveGauge.address,
      token.address,
      lender.address,
      constants.AddressZero,
      trustToken.address,
      truOracle.address,
      crvOracle.address,
    )

    await lender.initialize(pool.address, mockRatingAgency.address, mockStakingPool.address)
    provider = _provider
  })

  describe('initializer', () => {
    it('no initial allowances to curve', async () => {
      expect(await token.allowance(pool.address, curvePool.address)).to.equal(0)
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(0)
    })

    it('sets erc20 params', async () => {
      expect(await pool.name()).to.equal('TrueFi LP')
      expect(await pool.symbol()).to.equal('TFI-LP')
      expect(await pool.decimals()).to.equal(18)
    })

    it('no initial allowance to curve gauge', async () => {
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(0)
    })
  })

  it('cannot exit and join on same transaction', async () => {
    const arbitrage = await new PoolArbitrageTest__factory(owner).deploy()
    await token.transfer(arbitrage.address, parseEth(1))
    await expect(arbitrage.joinExit(pool.address)).to.be.revertedWith('TrueFiPool: Cannot join and exit in same block')
  })

  const calcBorrowerFee = (amount: BigNumber) => amount.mul(25).div(10000)

  describe('poolValue', () => {
    it('equals balance of tusd when no other tokens on balance', async () => {
      await token.approve(pool.address, includeFee(parseEth(1)))
      await pool.join(includeFee(parseEth(1)))
      expect(await pool.poolValue()).to.equal(parseEth(1))
    })

    it('price of loan tokens is added to pool value after loans were given', async () => {
      await token.approve(pool.address, includeFee(parseEth(1e7)))
      await pool.join(includeFee(parseEth(1e7)))
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 182.5)
      const loan2 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await lender.connect(borrower).fund(loan2.address)
      expectScaledCloseTo(await pool.poolValue(), parseEth(9e6).add(parseEth(105e4)).add(calcBorrowerFee(parseEth(2e6))))
    })

    it('loan tokens + tusd + curve liquidity + tru tokens', async () => {
      await token.approve(pool.address, includeFee(parseEth(1e7)))
      await pool.join(includeFee(parseEth(1e7)))
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 182.5)
      const loan2 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await lender.connect(borrower).fund(loan2.address)
      await pool.flush(parseEth(5e6), 0)
      await curvePool.set_withdraw_price(parseEth(2))
      expectScaledCloseTo(await pool.poolValue(), parseEth(4e6).add(parseEth(105e4).add(parseEth(1e7))).add(calcBorrowerFee(parseEth(2e6))))
      await trustToken.mint(pool.address, parseTRU(4e5))
      expect(await pool.truValue()).to.equal(parseEth(98000)) // 100000 - 2%
      expectScaledCloseTo(await pool.poolValue(), parseEth(4e6).add(parseEth(105e4).add(parseEth(1e7)).add(parseEth(98000))).add(calcBorrowerFee(parseEth(2e6))))
      await mockCrv.mint(pool.address, parseEth(1e5))
      expect(await pool.crvValue()).to.equal(parseEth(4.9e4)) // 50000 - 2%
      expectScaledCloseTo(await pool.poolValue(), parseEth(4e6).add(parseEth(105e4).add(parseEth(1e7)).add(parseEth(98000))).add(parseEth(4.9e4)).add(calcBorrowerFee(parseEth(2e6))))
    })
  })

  describe('setPauseStatus', () => {
    it('can be called by owner', async () => {
      await expect(pool.setPauseStatus(true))
        .not.to.be.reverted
      await expect(pool.setPauseStatus(false))
        .not.to.be.reverted
    })

    it('can be called by manager', async () => {
      await pool.setFundsManager(borrower.address)
      await expect(pool.connect(borrower).setPauseStatus(true))
        .not.to.be.reverted
      await expect(pool.connect(borrower).setPauseStatus(false))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(pool.connect(borrower).setPauseStatus(true))
        .to.be.revertedWith('TrueFiPool: Caller is neither owner nor funds manager')
      await expect(pool.connect(borrower).setPauseStatus(false))
        .to.be.revertedWith('TrueFiPool: Caller is neither owner nor funds manager')
    })

    it('properly changes pausing status', async () => {
      expect(await pool.pauseStatus()).to.be.false
      await pool.setPauseStatus(true)
      expect(await pool.pauseStatus()).to.be.true
      await pool.setPauseStatus(false)
      expect(await pool.pauseStatus()).to.be.false
    })

    it('emits proper event', async () => {
      await expect(pool.setPauseStatus(true))
        .to.emit(pool, 'PauseStatusChanged')
        .withArgs(true)
      await expect(pool.setPauseStatus(false))
        .to.emit(pool, 'PauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await token.approve(pool.address, includeFee(parseEth(1e7)))
      await pool.join(includeFee(parseEth(1e7)))
      await token.mint(borrower.address, includeFee(parseEth(1e6)))
      await token.connect(borrower).approve(pool.address, includeFee(parseEth(1e6)))
    })

    it('does not allow to join when joining is paused', async () => {
      await token.approve(pool.address, parseEth(1e6))
      await pool.setPauseStatus(true)
      await expect(pool.join(parseEth(1e6)))
        .to.be.revertedWith('TrueFiPool: Joining the pool is paused')
    })

    it('adds fee to claimable fees', async () => {
      expect(await pool.claimableFees()).to.equal(includeFee(parseEth(25000)))
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await pool.balanceOf(owner.address)).to.equal(parseEth(1e7))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 182.5)
      const totalSupply = await pool.totalSupply()
      const poolValue = await pool.poolValue()

      await pool.connect(borrower).join(includeFee(parseEth(1e6)))
      expectScaledCloseTo(await pool.balanceOf(borrower.address), totalSupply.mul(parseEth(1e6)).div(poolValue))
    })

    it('returns a basket of tokens on exit', async () => {
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, dayInSeconds * 182.5)
      const loan2 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 2500)
      await lender.connect(borrower).fund(loan2.address)
      await trustToken.mint(pool.address, parseTRU(1e7))
      await mockCrv.mint(pool.address, parseEth(3e5))

      const liquidValue = await pool.liquidValue()
      const tfiBalance = await pool.stakeTokenBalance()
      const crvBalance = await pool.crvBalance()
      const totalSupply = await pool.totalSupply()
      const exitAmount = totalSupply.div(2)

      await pool.exit(exitAmount)
      expect(await token.balanceOf(owner.address)).to.equal(exitAmount.mul(liquidValue).div(totalSupply))
      expect(await trustToken.balanceOf(owner.address)).to.equal(exitAmount.mul(tfiBalance).div(totalSupply))
      expect(await mockCrv.balanceOf(owner.address)).to.equal(exitAmount.mul(crvBalance).div(totalSupply))
      expectCloseTo(await loan1.balanceOf(owner.address), parseEth(55e4), 10)
      expectCloseTo(await loan2.balanceOf(owner.address), parseEth(625e3), 10)
    })

    describe('two stakers', () => {
      let loan1: LoanToken, loan2: LoanToken
      beforeEach(async () => {
        loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
        await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
        await lender.connect(borrower).fund(loan1.address)
        await timeTravel(provider, dayInSeconds * 182.5)
        // PoolValue is 10.05M USD at the moment
        // After join, owner has around 91% of shares
        await pool.connect(borrower).join(includeFee(parseEth(1e6)))
        loan2 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 2500)
        await lender.connect(borrower).fund(loan2.address)
      })

      it('returns a basket of tokens on exit, two stakers', async () => {
        await trustToken.mint(pool.address, parseEth(1e7))

        const liquidValue = await pool.liquidValue()
        const tfiBalance = await pool.stakeTokenBalance()
        const totalSupply = await pool.totalSupply()
        const exitAmount = totalSupply.div(2)

        await pool.exit(exitAmount)
        expect(await token.balanceOf(owner.address)).to.equal(exitAmount.mul(liquidValue).div(totalSupply))
        expect(await trustToken.balanceOf(owner.address)).to.equal(exitAmount.mul(tfiBalance).div(totalSupply))
        expectCloseTo(await loan1.balanceOf(owner.address), parseEth(55e4), 10)
        expectCloseTo(await loan2.balanceOf(owner.address), parseEth(625e3), 10)
      })

      it('erases all tokens after all stakers exit', async () => {
        const liquidValue = await pool.liquidValue()
        const totalSupply = await pool.totalSupply()
        const exitAmountBorrower = await pool.balanceOf(borrower.address)

        await mockStakingPool.unstake()
        const exitAmountOwner = await pool.balanceOf(owner.address)

        await pool.exit(exitAmountOwner)
        await pool.connect(borrower).exit(exitAmountBorrower)

        expect(await token.balanceOf(pool.address)).to.equal(await pool.claimableFees())
        expect(await loan1.balanceOf(pool.address)).to.equal(0)
        expect(await loan2.balanceOf(pool.address)).to.equal(0)

        expectScaledCloseTo(await token.balanceOf(owner.address), exitAmountOwner.mul(liquidValue).div(totalSupply))
        expectScaledCloseTo(await loan1.balanceOf(owner.address), parseEth(11e5).mul(exitAmountOwner).div(totalSupply))
        expectScaledCloseTo(await loan2.balanceOf(owner.address), parseEth(125e4).mul(exitAmountOwner).div(totalSupply))

        expectScaledCloseTo(await token.balanceOf(borrower.address), exitAmountBorrower.mul(liquidValue).div(totalSupply))
        expectScaledCloseTo(await loan1.balanceOf(borrower.address), parseEth(11e5).mul(exitAmountBorrower).div(totalSupply))
        expectScaledCloseTo(await loan2.balanceOf(borrower.address), parseEth(125e4).mul(exitAmountBorrower).div(totalSupply))
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

    it('can be called by funds manager', async () => {
      await pool.setFundsManager(borrower.address)
      await expect(pool.flush(parseEth(100), 123)).to.be.not.reverted
    })

    it('reverts if flushing more than tUSD balance', async () => {
      await expect(pool.flush(parseEth(1e7 + 1), 0)).to.be.revertedWith('TrueFiPool: Insufficient currency balance')
    })

    it('deposits liquidity tokens in curve gauge', async () => {
      await expect('deposit').to.be.calledOnContractWith(mockCurveGauge, [parseEth(100)])
    })

    it('curvePool allowance is 0 after flushing', async () => {
      await pool.flush(parseEth(100), 123)
      expect(await token.allowance(pool.address, curvePool.address)).to.eq(0)
    })

    it('curveGauge allowance remains (Mock)', async () => {
      await pool.flush(parseEth(100), 123)
      expect(await curveToken.allowance(pool.address, mockCurveGauge.address)).to.eq(parseEth(100))
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

    it('curvePool allowance is 0 after pull', async () => {
      await pool.pull(parseEth(100), 123)
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.eq(0)
    })

    it('reverts if not called by owner or funds manager', async () => {
      await expect(pool.connect(borrower).pull(1, 0)).to.be.revertedWith('TrueFiPool: Caller is neither owner nor funds manager')
    })

    it('reverts if flushing more than curve balance', async () => {
      await expect(pool.pull(parseEth(1001), 0)).to.be.revertedWith('TrueFiPool: Insufficient Curve liquidity balance')
    })
  })

  describe('borrow-repay', () => {
    let pool2: TestTrueFiPool

    beforeEach(async () => {
      pool2 = await new TestTrueFiPool__factory(owner).deploy()
      await pool2.initialize(
        curvePool.address,
        mockCurveGauge.address,
        token.address,
        borrower.address,
        constants.AddressZero,
        trustToken.address,
        AddressZero,
        AddressZero,
      )
      await token.approve(pool2.address, includeFee(parseEth(1e7)))
      await pool2.join(includeFee(parseEth(1e7)))
      await pool2.flush(parseEth(5e6), 0)
    })

    it('reverts if borrower is not a lender', async () => {
      await expect(pool2['borrow(uint256,uint256)'](parseEth(1001), 0)).to.be.revertedWith('TrueFiPool: Caller is not the lender')
    })

    it('reverts if repayer is not a lender', async () => {
      await pool2.connect(borrower)['borrow(uint256,uint256)'](parseEth(1001), 0)
      await expect(pool2.repay(parseEth(1001)))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender')
    })

    it('when borrowing less than trueCurrency balance, uses the balance', async () => {
      const borrowedAmount = parseEth(5e6)
      await pool2.connect(borrower)['borrow(uint256,uint256)'](borrowedAmount, 0)
      expect(await token.balanceOf(borrower.address)).to.equal(borrowedAmount)
      expect(await token.balanceOf(pool2.address)).to.equal(await pool2.claimableFees())

      await token.connect(borrower).approve(pool2.address, borrowedAmount)
      await pool2.connect(borrower).repay(borrowedAmount)
      expect(await token.balanceOf(borrower.address)).to.equal(0)
      expect(await token.balanceOf(pool2.address)).to.equal(borrowedAmount.add(await pool2.claimableFees()))
    })

    it('when trueCurrency balance is not enough, withdraws from curve', async () => {
      await token.mint(curvePool.address, parseEth(2e6))
      await curvePool.set_withdraw_price(parseEth(1.5))
      await pool2.connect(borrower)['borrow(uint256,uint256)'](parseEth(6e6), 0)
      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(6e6))
    })

    it('curvePool allowance is 0 after borrow', async () => {
      await token.mint(curvePool.address, parseEth(2e6))
      await curvePool.set_withdraw_price(parseEth(1.5))
      await pool2.connect(borrower)['borrow(uint256,uint256)'](parseEth(6e6), 0)
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.eq(0)
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

    it('reverts when called not by owner or funds manager', async () => {
      await expect(pool.connect(borrower).collectFees(beneficiary)).to.be.revertedWith('TrueFiPool: Caller is neither owner nor funds manager')
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
      await expect(pool.averageExitPenalty(10, 9)).to.be.revertedWith('TrueFiPool: To precedes from')
    })

    it('correctly calculates penalty when from = to', async () => {
      await testPenalty(0, 0, 1000)
      await testPenalty(1, 1, 980)
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
    const amount = parseEth(1e7)
    beforeEach(async () => {
      await token.approve(pool.address, includeFee(amount))
      await pool.join(includeFee(amount))
    })

    it('burns pool tokens on exit', async () => {
      const supply = await pool.totalSupply()
      await pool.liquidExit(supply.div(2))
      expect(await pool.totalSupply()).to.equal(supply.div(2))
      await pool.liquidExit(supply.div(3))
      expect(await pool.totalSupply()).to.equal(supply.sub(supply.mul(5).div(6)))
    })

    it('all funds are liquid: transfers TUSD without penalty', async () => {
      await pool.liquidExit(await pool.balanceOf(owner.address))
      expect(await token.balanceOf(owner.address)).to.equal(amount)
    })

    it('all funds are liquid: transfers TUSD without penalty (half of stake)', async () => {
      await pool.liquidExit(amount.div(2))
      expect(await token.balanceOf(owner.address)).to.equal(amount.div(2))
    })

    it('after loan approved, applies a penalty', async () => {
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, amount.div(3), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      expect(await pool.liquidExitPenalty(amount.div(2))).to.equal(9990)
      await pool.liquidExit(amount.div(2), { gasLimit: 5000000 })
      expectScaledCloseTo(await token.balanceOf(owner.address), (amount.div(2).mul(9990).div(10000)))
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(0)
    })

    it('half funds are in curve: transfers TUSD without penalty and leaves curve with 0 allowance', async () => {
      await pool.flush(parseEth(5e6), 0)
      await pool.liquidExit(parseEth(6e6))
      expect(await token.balanceOf(owner.address)).to.equal(parseEth(6e6))
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(0)
    })

    it('half funds are in curve and curve earns: transfers TUSD without penalty and leaves curve with 0 allowance', async () => {
      await pool.flush(parseEth(5e6), 0)
      await curvePool.set_withdraw_price(parseEth(2))
      await pool.liquidExit(parseEth(6e6))
      expect(await token.balanceOf(owner.address)).to.equal(parseEth(9e6))
      expect(await curveToken.allowance(pool.address, curvePool.address)).to.equal(0)
    })

    it('calls remove_liquidity_one_coin with correct arguments', async () => {
      await curvePool.set_withdraw_price(parseEth(2))
      const amount = parseEth(5e6)
      await pool.flush(amount, 0)
      provider.clearCallHistory()
      await pool.liquidExit(parseEth(6e6))

      const withdrawalCrvAmount = parseEth(6e6).sub(parseEth(5e6)).div(2).mul(1005).div(1000)
      const minTusdWithdrawn = withdrawalCrvAmount.mul(2).mul(999).div(1000)
      expect('remove_liquidity_one_coin')
        .to.be.calledOnContractWith(curvePool, [withdrawalCrvAmount, 3, minTusdWithdrawn, false])
    })

    it('emits event', async () => {
      await expect(pool.liquidExit(amount.div(2))).to.emit(pool, 'Exited').withArgs(owner.address, amount.div(2))
    })

    it('liquid exit costs less than 400,000 gas', async () => {
      // previous cost ~1178466 gas
      // expect around ~365006 gas
      const txn = await (await pool.liquidExit(await pool.balanceOf(owner.address))).wait()
      expect(txn.gasUsed.toNumber()).to.be.lt(400000)
    })
  })

  describe('flow with TrueFi2', () => {
    let loanFactory2: LoanFactory2
    let lender2: TrueLender2
    let liquidator2: Liquidator2

    beforeEach(async () => {
      const poolImplementation = await new TrueFiPool2__factory(owner).deploy()
      const implementationReference = await new ImplementationReference__factory(owner).deploy(poolImplementation.address)

      const factory = await new PoolFactory__factory(owner).deploy()
      lender2 = await new TrueLender2__factory(owner).deploy()
      await lender2.initialize(mockStakingPool.address, factory.address, mockRatingAgency.address, AddressZero)
      await factory.initialize(implementationReference.address, trustToken.address, lender2.address)
      await factory.addLegacyPool(pool.address)
      const usdc = await new MockErc20Token__factory(owner).deploy()
      await factory.setAllowAll(true)
      await factory.createPool(usdc.address)
      const feePool = await factory.pool(usdc.address)
      await lender2.setFeePool(feePool)
      loanFactory2 = await new LoanFactory2__factory(owner).deploy()
      liquidator2 = await new Liquidator2__factory(owner).deploy()
      await loanFactory2.initialize(factory.address, lender2.address, liquidator2.address)
      await liquidator2.initialize(mockStakingPool.address, trustToken.address, loanFactory2.address)
      await pool.setLender2(lender2.address)
      await token.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
    })

    async function fundLoan () {
      const tx = await (await loanFactory2.createLoanToken(pool.address, 1000, DAY, 100)).wait()
      const newLoanAddress = tx.events[0].args.contractAddress
      const loan = LoanToken2__factory.connect(newLoanAddress, owner)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseEth(100))
      await lender2.fund(newLoanAddress)
      return { newLoanAddress, loan }
    }

    it('funds and repays loan', async () => {
      const { newLoanAddress, loan } = await fundLoan()
      await loan.settle()
      await lender2.reclaim(newLoanAddress, '0x')
    })

    it('funds and liquidates loan', async () => {
      const { loan } = await fundLoan()
      await loan.withdraw(owner.address)
      await timeTravel(provider, DAY * 3)
      await loan.enterDefault()
      await liquidator2.setTokenApproval(token.address, true)
      await liquidator2.liquidate(loan.address)
    })

    it('distributions with 2 lenders', async () => {
      await fundLoan()
      const loan1 = await new LoanToken__factory(owner).deploy(token.address, borrower.address, lender.address, lender.address, parseEth(1e6), dayInSeconds * 365, 1000)
      await mockRatingAgency.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      expect(await pool.loansValue()).to.equal((await lender.value()).add(await lender2.value(pool.address)))
    })
  })
})
