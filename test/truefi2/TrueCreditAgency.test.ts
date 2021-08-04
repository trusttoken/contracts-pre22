import { BigNumber, BigNumberish, Wallet } from 'ethers'
import {
  LoanFactory2,
  TrueLender2,
  MockTrueCurrency,
  StkTruToken,
  TrueCreditAgency,
  TrueFiCreditOracle,
  TrueFiPool2,
  TrueRatingAgencyV2,
  MockUsdc,
} from 'contracts'
import {
  beforeEachWithFixture,
  createApprovedLoan, DAY, parseEth, parseUSDC, setupTruefi2,
  timeTravel as _timeTravel,
  YEAR,
} from 'utils'
import { expect } from 'chai'
import { AddressZero } from '@ethersproject/constants'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { TrueFiPool2Json } from 'build'

describe('TrueCreditAgency', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let borrower2: Wallet
  let creditAgency: TrueCreditAgency
  let tusd: MockTrueCurrency
  let tusdPool: TrueFiPool2
  let usdc: MockUsdc
  let usdcPool: TrueFiPool2
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let loanFactory: LoanFactory2
  let rater: TrueRatingAgencyV2
  let lender: TrueLender2
  let creditOracle: TrueFiCreditOracle
  let timeTravel: (time: number) => void

  const MONTH = DAY * 31

  async function setupBorrower (borrower: Wallet, score: number, amount: BigNumberish) {
    await creditAgency.allowBorrower(borrower.address, YEAR * 10)
    await creditOracle.setScore(borrower.address, score)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))

    await creditAgency.connect(borrower).borrow(tusdPool.address, amount)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, borrower2] = wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)
    provider = _provider

    ;({
      standardToken: tusd,
      standardPool: tusdPool,
      feeToken: usdc,
      feePool: usdcPool,
      loanFactory,
      tru,
      stkTru,
      rater,
      lender,
      creditAgency,
      creditOracle,
    } = await setupTruefi2(owner))

    await tusdPool.setCreditAgency(creditAgency.address)
    await creditAgency.allowPool(tusdPool.address, true)

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(tusdPool.address, parseEth(1e7))
    await tusdPool.join(parseEth(1e7))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(owner.address, parseEth(100_000_000))
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
  })

  describe('initializer', () => {
    it('sets creditOracle', async () => {
      expect(await creditAgency.creditOracle()).to.equal(creditOracle.address)
    })

    it('sets interestRepaymentPeriod', async () => {
      expect(await creditAgency.interestRepaymentPeriod()).to.equal(MONTH)
    })

    it('sets riskPremium', async () => {
      expect(await creditAgency.riskPremium()).to.eq(100)
    })
  })

  describe('Ownership', () => {
    it('owner is set to msg.sender of initialize()', async () => {
      expect(await creditAgency.owner()).to.equal(owner.address)
    })

    it('ownership transfer', async () => {
      await creditAgency.transferOwnership(borrower.address)
      expect(await creditAgency.owner()).to.equal(owner.address)
      expect(await creditAgency.pendingOwner()).to.equal(borrower.address)
      await creditAgency.connect(borrower).claimOwnership()
      expect(await creditAgency.owner()).to.equal(borrower.address)
      expect(await creditAgency.pendingOwner()).to.equal(AddressZero)
    })
  })

  describe('setRiskPremium', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setRiskPremium(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes riskPremium rate', async () => {
      await creditAgency.setRiskPremium(1)
      expect(await creditAgency.riskPremium()).to.eq(1)
    })

    it('pokes every pool', async () => {
      await creditAgency.setRiskPremium(1)

      await usdc.mint(owner.address, parseEth(1e7))
      await usdc.approve(usdcPool.address, parseEth(1e7))
      await usdcPool.join(parseEth(1e7))
      await creditAgency.allowPool(usdcPool.address, true)
      await usdcPool.setCreditAgency(creditAgency.address)

      await creditOracle.setScore(owner.address, 150)
      await creditAgency.allowBorrower(borrower.address, YEAR * 10)
      await creditAgency.allowBorrower(owner.address, YEAR * 10)

      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await creditAgency.connect(owner).borrow(usdcPool.address, 1000)

      const tusdBucketBefore = await creditAgency.buckets(tusdPool.address, 255)
      const usdcBucketBefore = await creditAgency.buckets(usdcPool.address, 150)
      await creditAgency.setRiskPremium(2)
      const tusdBucketAfter = await creditAgency.buckets(tusdPool.address, 255)
      const usdcBucketAfter = await creditAgency.buckets(usdcPool.address, 150)
      expect(tusdBucketBefore.rate.add(1)).to.eq(tusdBucketAfter.rate)
      expect(usdcBucketBefore.rate.add(1)).to.eq(usdcBucketAfter.rate)
    })

    it('emits event', async () => {
      await expect(creditAgency.setRiskPremium(1))
        .to.emit(creditAgency, 'RiskPremiumChanged')
        .withArgs(1)
    })
  })

  describe('setInterestRepaymentPeriod', () => {
    it('only owner can set repayment period', async () => {
      await expect(creditAgency.connect(borrower).setInterestRepaymentPeriod(0))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('period is properly set', async () => {
      await creditAgency.setInterestRepaymentPeriod(DAY)
      expect(await creditAgency.interestRepaymentPeriod()).to.equal(DAY)
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.setInterestRepaymentPeriod(DAY))
        .to.emit(creditAgency, 'InterestRepaymentPeriodChanged')
        .withArgs(DAY)
    })
  })

  describe('setCreditAdjustmentCoefficient', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setCreditAdjustmentCoefficient(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes credit adjustment coefficient', async () => {
      await creditAgency.setCreditAdjustmentCoefficient(1)
      expect(await creditAgency.creditAdjustmentCoefficient()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(creditAgency.setCreditAdjustmentCoefficient(1))
        .to.emit(creditAgency, 'CreditAdjustmentCoefficientChanged')
        .withArgs(1)
    })
  })

  describe('setUtilizationAdjustmentCoefficient', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setUtilizationAdjustmentCoefficient(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes utilization adjustment coefficient', async () => {
      await creditAgency.setUtilizationAdjustmentCoefficient(1)
      expect(await creditAgency.utilizationAdjustmentCoefficient()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(creditAgency.setUtilizationAdjustmentCoefficient(1))
        .to.emit(creditAgency, 'UtilizationAdjustmentCoefficientChanged')
        .withArgs(1)
    })
  })

  describe('setUtilizationAdjustmentPower', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setUtilizationAdjustmentPower(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes utilization adjustment power', async () => {
      await creditAgency.setUtilizationAdjustmentPower(1)
      expect(await creditAgency.utilizationAdjustmentPower()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(creditAgency.setUtilizationAdjustmentPower(1))
        .to.emit(creditAgency, 'UtilizationAdjustmentPowerChanged')
        .withArgs(1)
    })
  })

  describe('setMinCreditScore', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setMinCreditScore(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes minimal credit score', async () => {
      await creditAgency.setMinCreditScore(1)
      expect(await creditAgency.minCreditScore()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(creditAgency.setMinCreditScore(1))
        .to.emit(creditAgency, 'MinCreditScoreChanged')
        .withArgs(1)
    })
  })

  describe('Borrower allowance', () => {
    it('only owner can set allowance', async () => {
      await expect(creditAgency.connect(borrower).allowBorrower(borrower.address, YEAR))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('allowance time is properly set', async () => {
      expect(await creditAgency.borrowerAllowedUntilTime(borrower.address)).to.equal(0)
      const tx = await creditAgency.allowBorrower(borrower.address, YEAR)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.borrowerAllowedUntilTime(borrower.address)).to.equal(timestamp.add(YEAR))
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.allowBorrower(borrower.address, YEAR))
        .to.emit(creditAgency, 'BorrowerAllowed')
        .withArgs(borrower.address, YEAR)
    })
  })

  describe('Setting pool allowance', () => {
    const expectNotLongerThan = async (length: number) => {
      try {
        await creditAgency.pools(length)
      } catch (err) {
        expect(err.message).to.contain('invalid opcode')
      }
    }
    it('can only be called by the owner', async () => {
      await expect(creditAgency.connect(borrower).allowPool(tusdPool.address, true)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes pool allowance status', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.false
      await creditAgency.allowPool(tusdPool.address, true)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.true
    })

    it('emits event', async () => {
      await expect(creditAgency.allowPool(tusdPool.address, false)).to.emit(creditAgency, 'PoolAllowed')
        .withArgs(tusdPool.address, false)
    })

    it('adds allowed pool to the pools list', async () => {
      expect(await creditAgency.pools(0)).to.equal(tusdPool.address)
      const newPool = Wallet.createRandom().address
      await creditAgency.allowPool(newPool, true)
      expect(await creditAgency.pools(0)).to.equal(tusdPool.address)
      expect(await creditAgency.pools(1)).to.equal(newPool)
      await expectNotLongerThan(2)
    })

    it('removes pool from list when it is dewhitelisted', async () => {
      const newPool1 = Wallet.createRandom().address
      const newPool2 = Wallet.createRandom().address
      await creditAgency.allowPool(newPool1, true)
      await creditAgency.allowPool(newPool2, true)
      await creditAgency.allowPool(newPool1, false)
      expect(await creditAgency.pools(0)).to.equal(tusdPool.address)
      expect(await creditAgency.pools(1)).to.equal(newPool2)
      await expectNotLongerThan(2)
      await creditAgency.allowPool(tusdPool.address, false)
      expect(await creditAgency.pools(0)).to.equal(newPool2)
      await expectNotLongerThan(1)
      await creditAgency.allowPool(newPool2, false)
      await expectNotLongerThan(0)
    })

    it('does not revert when whitelisting whitelisted pool', async () => {
      await expect(creditAgency.allowPool(tusdPool.address, true)).to.not.be.reverted
    })

    it('does not revert when dewhitelising not whitelisted pool', async () => {
      await creditAgency.allowPool(tusdPool.address, true)
      await expect(creditAgency.allowPool(tusdPool.address, false)).to.not.be.reverted
    })
  })

  describe('totalTVL & totalBorrowed', () => {
    beforeEach(async () => {
      await usdcPool.setCreditAgency(creditAgency.address)
      await creditAgency.allowPool(usdcPool.address, true)

      await usdc.mint(owner.address, parseUSDC(2e7))
      await usdc.approve(usdcPool.address, parseUSDC(2e7))
      await usdcPool.join(parseUSDC(2e7))
    })

    it('totalTVL returns sum of poolValues of all pools with 18 decimals precision', async () => {
      expect(await creditAgency.totalTVL(18)).to.equal(parseEth(3e7))
    })

    it('totalBorrowed returns total borrowed amount across all pools with 18 decimals precision', async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(100))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(500))
      expect(await creditAgency.totalBorrowed(borrower.address, 18)).to.equal(parseEth(600))
    })

    // Run when totalTVL includes credit value
    xit('totalTVL remains unchanged after borrowing', async () => {
      expect(await creditAgency.totalTVL(18)).to.equal(parseEth(3e7))
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(100))
      expect(await creditAgency.totalTVL(18)).to.equal(parseEth(3e7))
    })
  })

  describe('borrowLimitAdjustment', () => {
    [
      [255, 10000],
      [223, 9043],
      [191, 8051],
      [159, 7016],
      [127, 5928],
      [95, 4768],
      [63, 3504],
      [31, 2058],
      [1, 156],
      [0, 0],
    ].map(([score, adjustment]) =>
      it(`returns ${adjustment} when score is ${score}`, async () => {
        expect(await creditAgency.borrowLimitAdjustment(score)).to.equal(adjustment)
      }),
    )
  })

  describe('Borrow limit', () => {
    let pool1: MockContract
    let pool2: MockContract

    beforeEach(async () => {
      pool1 = await deployMockContract(owner, TrueFiPool2Json.abi)
      pool2 = await deployMockContract(owner, TrueFiPool2Json.abi)
      await pool1.mock.poolValue.returns(parseEth(1000))
      await pool1.mock.decimals.returns(18)
      await pool1.mock.borrow.returns()
      await pool1.mock.token.returns(tusd.address)
      await pool2.mock.poolValue.returns(parseUSDC(10000))
      await pool2.mock.decimals.returns(6)
      await pool2.mock.borrow.returns()
      await pool2.mock.token.returns(tusd.address)
      await creditAgency.allowPool(pool1.address, true)
      await creditAgency.allowPool(pool2.address, true)
      await creditOracle.setScore(borrower.address, 191) // adjustment = 0.8051
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await tusd.mint(creditAgency.address, parseEth(1000))
    })

    it('borrow amount is limited by borrower limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))
      expect(await creditAgency.borrowLimit(tusdPool.address, borrower.address)).to.equal(parseEth(80.51))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(80.51))
    })

    it('borrow amount is limited by total TVL', async () => {
      await pool1.mock.poolValue.returns(parseEth(1))
      await pool2.mock.poolValue.returns(parseUSDC(3))
      const maxTVLLimit = (await creditAgency.totalTVL(18)).mul(15).div(100)
      expect(await creditAgency.borrowLimit(tusdPool.address, borrower.address)).to.equal(maxTVLLimit.mul(8051).div(10000))
    })

    it('borrow amount is limited by a single pool value', async () => {
      await pool2.mock.poolValue.returns(parseUSDC(3))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(3).mul(15).div(100))
    })

    it('cannot borrow more than 15% of a single pool in total', async () => {
      await pool2.mock.poolValue.returns(parseUSDC(3))
      await creditAgency.connect(borrower).borrow(pool2.address, parseUSDC(0.4))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(0.05))
      await creditAgency.connect(borrower).borrow(pool2.address, parseUSDC(0.05))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(0)
      await pool2.mock.poolValue.returns(parseUSDC(4))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(0.15))
      await pool2.mock.poolValue.returns(parseUSDC(2))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(0))
    })

    it('borrow limit is 0 if credit limit is above the borrowed amount', async () => {
      await pool2.mock.poolValue.returns(parseUSDC(3))
      await creditAgency.connect(borrower).borrow(pool2.address, parseUSDC(0.4))
      await pool2.mock.poolValue.returns(parseUSDC(2))
      expect(await creditAgency.borrowLimit(pool2.address, borrower.address)).to.equal(parseUSDC(0))
    })
  })

  describe('Borrowing', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
    })

    it('borrows funds from the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(1000)
    })

    it('fails if borrower is not whitelisted', async () => {
      await creditAgency.allowBorrower(borrower.address, 0)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Sender is not allowed to borrow')
    })

    it('fails if borrower has credit score below required', async () => {
      await creditOracle.setScore(borrower.address, 191)
      await creditAgency.setMinCreditScore(192)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Borrower has credit score below minimum')
    })

    it('fails if borrower tries to borrow after whitelist period', async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await timeTravel(YEAR)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Sender is not allowed to borrow')
    })

    it('cannot borrow from the pool that is not whitelisted', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: The pool is not whitelisted for borrowing')
    })

    it('updates nextInterestRepayTime', async () => {
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(0)
      const tx = await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('does not update nextInterestRepayTime on debt increase', async () => {
      const tx = await creditAgency.connect(borrower).borrow(tusdPool.address, 500)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
      await creditAgency.connect(borrower).borrow(tusdPool.address, 500)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('cannot borrow over the borrow limit', async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditOracle.setScore(borrower.address, 191)
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))

      expect(await creditAgency.borrowLimit(tusdPool.address, borrower.address)).to.eq(parseEth(80.51))
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(80.51).add(1)))
        .to.be.revertedWith('TrueCreditAgency: Borrow amount cannot exceed borrow limit')

      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(75))

      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(5.51).add(1)))
        .to.be.revertedWith('TrueCreditAgency: Borrow amount cannot exceed borrow limit')
    })

    it('correctly handles the case when credit score is changing', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.creditScore(tusdPool.address, borrower.address)).to.equal(255)
      expect((await creditAgency.buckets(tusdPool.address, 255)).totalBorrowed).to.equal(1000)
      expect((await creditAgency.buckets(tusdPool.address, 255)).borrowersCount).to.equal(1)

      await creditOracle.setScore(borrower.address, 200)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.creditScore(tusdPool.address, borrower.address)).to.equal(200)
      expect((await creditAgency.buckets(tusdPool.address, 255)).totalBorrowed).to.equal(0)
      expect((await creditAgency.buckets(tusdPool.address, 255)).borrowersCount).to.equal(0)
      expect((await creditAgency.buckets(tusdPool.address, 200)).totalBorrowed).to.equal(2000)
      expect((await creditAgency.buckets(tusdPool.address, 200)).borrowersCount).to.equal(1)
    })
  })

  describe('Credit score rate adjustment', () => {
    [
      [255, 0],
      [223, 143],
      [191, 335],
      [159, 603],
      [127, 1007],
      [95, 1684],
      [63, 3047],
      [31, 7225],
      [5, 50000],
      [1, 50000],
      [0, 50000],
    ].map(([score, adjustment]) =>
      it(`returns ${adjustment} when score is ${score}`, async () => {
        await creditOracle.setScore(borrower.address, score)
        await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
        expect(await creditAgency.creditScoreAdjustmentRate(tusdPool.address, borrower.address)).to.equal(adjustment)
      }),
    )
  })

  describe('utilizationAdjustmentRate', () => {
    const setUtilization = async (pool: TrueFiPool2, utilization: number) => {
      if (utilization === 0) {
        return
      }
      const utilizationAmount = (await pool.poolValue()).mul(utilization).div(100)
      const loan = await createApprovedLoan(
        rater, tru, stkTru,
        loanFactory, borrower, tusdPool,
        utilizationAmount, DAY, 1,
        owner, provider,
      )
      await lender.connect(borrower).fund(loan.address)
    }

    describe('setUtilization', () => {
      [0, 20, 50, 80, 100].map((utilization) => {
        it(`sets utilization to ${utilization} percent`, async () => {
          await setUtilization(tusdPool, utilization)
          expect(await tusdPool.utilization()).to.eq(utilization * 100)
        })
      })
    })

    ;[
      [0, 0],
      [10, 11],
      [20, 28],
      [30, 52],
      [40, 88],
      [50, 150],
      [60, 262],
      [70, 505],
      [80, 1200],
      [90, 4950],
      [95, 19950],
      [99, 50000],
      [100, 50000],
    ].map(([utilization, adjustment]) =>
      it(`returns ${adjustment} if utilization is at ${utilization} percent`, async () => {
        await setUtilization(tusdPool, utilization)
        expect(await creditAgency.utilizationAdjustmentRate(tusdPool.address)).to.eq(adjustment)
      }),
    )
  })

  describe('payInterest', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.setRiskPremium(1000)
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1000)
      await timeTravel(YEAR)
    })

    it('pays interest to the pool', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)

      expect(await tusd.balanceOf(borrower.address)).to.be.closeTo(BigNumber.from(900), 2)
      expect(await tusd.balanceOf(tusdPool.address)).to.be.closeTo(parseEth(1e7).sub(900), 2)
    })

    it('increases totalPaidInterest', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('pays close to nothing on second call', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('updates nextInterestRepayTime', async () => {
      const tx = await creditAgency.connect(borrower).payInterest(tusdPool.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('emits event', async () => {
      await expect(creditAgency.connect(borrower).payInterest(tusdPool.address))
        .to.emit(creditAgency, 'InterestPaid')
        .withArgs(tusdPool.address, borrower.address, 100)
    })
  })

  describe('repay', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.setRiskPremium(1000)
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1000)
    })

    it('cannot repay more than debt', async () => {
      await expect(creditAgency.connect(borrower).repay(tusdPool.address, 2000))
        .to.be.revertedWith('TrueCreditAgency: Cannot repay over the debt')
    })

    it('repays debt to the pool', async () => {
      await creditAgency.connect(borrower).repay(tusdPool.address, 500)

      expect(await tusd.balanceOf(borrower.address)).to.eq(500)
      expect(await tusd.balanceOf(tusdPool.address)).to.eq(parseEth(1e7).sub(500))
    })

    it('repays partial interest to the pool', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 50)

      expect(await tusd.balanceOf(borrower.address)).to.be.closeTo(BigNumber.from(950), 2)
      expect(await tusd.balanceOf(tusdPool.address)).to.be.closeTo(parseEth(1e7).sub(950), 2)
    })

    it('reduces borrowed amount', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 500)
      expect(await creditAgency.borrowed(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(600), 2)
    })

    it('updates totalPaidInterest on whole interest repayment', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 500)

      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('updates totalPaidInterest on partial interest repayment', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 50)

      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(50), 2)
    })

    it('partial interest repay does not trigger principal repayment', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 50)

      expect(await creditAgency.borrowed(tusdPool.address, borrower.address)).to.eq(1000)
    })

    it('updates nextInterestRepayTime when interest repaid', async () => {
      await timeTravel(YEAR)
      const tx = await creditAgency.connect(borrower).repay(tusdPool.address, 500)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('does not update nextInterestRepayTime when interest repaid partially', async () => {
      const prevNextInterestRepayTime = await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 50)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(prevNextInterestRepayTime)
    })

    it('calls _rebucket', async () => {
      const bucketBefore = await creditAgency.buckets(tusdPool.address, 255)
      await creditAgency.connect(borrower).repay(tusdPool.address, 500)
      const bucketAfter = await creditAgency.buckets(tusdPool.address, 255)

      expect(bucketBefore.borrowersCount).to.eq(bucketAfter.borrowersCount)
      expect(bucketBefore.timestamp).to.be.lt(bucketAfter.timestamp)
      expect(bucketBefore.rate).to.eq(bucketAfter.rate)
      expect(bucketBefore.cumulativeInterestPerShare).to.be.lt(bucketAfter.cumulativeInterestPerShare)
      expect(bucketBefore.totalBorrowed).to.eq(bucketAfter.totalBorrowed.add(500))
    })

    it('emits PrincipalRepaid event', async () => {
      await timeTravel(YEAR)
      await expect(creditAgency.connect(borrower).repay(tusdPool.address, 500))
        .to.emit(creditAgency, 'PrincipalRepaid')
        .withArgs(tusdPool.address, borrower.address, 400)
    })

    it('emits InterestPaid event', async () => {
      await timeTravel(YEAR)
      await expect(creditAgency.connect(borrower).repay(tusdPool.address, 500))
        .to.emit(creditAgency, 'InterestPaid')
        .withArgs(tusdPool.address, borrower.address, 100)
    })
  })

  describe('repayInFull', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.setRiskPremium(1000)
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.mint(borrower.address, 200)
      await tusd.connect(borrower).approve(creditAgency.address, 1200)
    })

    it('repays debt to the pool', async () => {
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)

      expect(await tusd.balanceOf(borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await tusd.balanceOf(tusdPool.address)).to.be.closeTo(parseEth(1e7), 2)
    })

    it('repays debt in full', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      expect(await creditAgency.borrowed(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('calls payInterest', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)

      expect(await creditAgency.totalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('calls _rebucket', async () => {
      const bucketBefore = await creditAgency.buckets(tusdPool.address, 255)
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      const bucketAfter = await creditAgency.buckets(tusdPool.address, 255)

      expect(bucketBefore.borrowersCount).to.eq(bucketAfter.borrowersCount)
      expect(bucketBefore.timestamp).to.be.lt(bucketAfter.timestamp)
      expect(bucketBefore.rate).to.eq(bucketAfter.rate)
      expect(bucketBefore.cumulativeInterestPerShare).to.be.lt(bucketAfter.cumulativeInterestPerShare)
      expect(bucketBefore.totalBorrowed).to.eq(bucketAfter.totalBorrowed.add(1000))
    })

    it('updates nextInterestRepayTime', async () => {
      const tx = await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('emits event', async () => {
      await timeTravel(YEAR)
      await expect(creditAgency.connect(borrower).repayInFull(tusdPool.address))
        .to.emit(creditAgency, 'PrincipalRepaid')
        .withArgs(tusdPool.address, borrower.address, 1000)
    })
  })

  describe('Credit score change', () => {
    const usedBucketSet = (...usedBuckets: number[]) => usedBuckets
      .map((bucket) => BigNumber.from(2).pow(bucket))
      .reduce((sum, bit) => sum.add(bit), BigNumber.from(0))

    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR)
      await creditAgency.allowBorrower(owner.address, YEAR)
      await creditOracle.setScore(owner.address, 200)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await creditAgency.borrow(tusdPool.address, 2000)
    })

    it('borrower becomes part of the bucket with a corresponding credit score', async () => {
      const bucket255 = await creditAgency.buckets(tusdPool.address, 255)
      const bucket200 = await creditAgency.buckets(tusdPool.address, 200)
      expect(bucket255.borrowersCount).to.equal(1)
      expect(bucket200.borrowersCount).to.equal(1)
      expect(bucket255.totalBorrowed).to.equal(1000)
      expect(bucket200.totalBorrowed).to.equal(2000)
    })

    it('usedBuckets are constructed by setting bits for buckets on positions of buckets that have any borrowers', async () => {
      expect(await creditAgency.usedBucketsBitmap()).to.equal(usedBucketSet(200, 255))
    })

    it('when score changes, borrower is moved between buckets and used bucket map is updated', async () => {
      await creditOracle.setScore(owner.address, 100)
      await creditAgency.updateCreditScore(tusdPool.address, owner.address)
      const bucket200 = await creditAgency.buckets(tusdPool.address, 200)
      const bucket100 = await creditAgency.buckets(tusdPool.address, 100)
      expect(bucket200.borrowersCount).to.equal(0)
      expect(bucket100.borrowersCount).to.equal(1)
      expect(bucket200.totalBorrowed).to.equal(0)
      expect(bucket100.totalBorrowed).to.equal(2000)
      expect(await creditAgency.usedBucketsBitmap()).to.equal(usedBucketSet(100, 255))
    })

    it('correctly updates bucket map when adding borrower to non-empty bucket', async () => {
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.updateCreditScore(tusdPool.address, owner.address)
      const bucket255 = await creditAgency.buckets(tusdPool.address, 255)
      expect(bucket255.borrowersCount).to.equal(2)
      expect(bucket255.totalBorrowed).to.equal(3000)
      expect(await creditAgency.usedBucketsBitmap()).to.equal(usedBucketSet(255))
    })

    it('correctly updates bucket map when removing borrowers from bucket with multiple borrowers', async () => {
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.updateCreditScore(tusdPool.address, owner.address)
      await creditOracle.setScore(borrower.address, 150)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      const bucket255 = await creditAgency.buckets(tusdPool.address, 255)
      expect(bucket255.borrowersCount).to.equal(1)
      expect(bucket255.totalBorrowed).to.equal(2000)
      expect(await creditAgency.usedBucketsBitmap()).to.equal(usedBucketSet(255, 150))
    })
  })

  describe('Interest calculation', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, YEAR * 10)
      await creditAgency.allowBorrower(owner.address, YEAR * 10)
      await creditAgency.setRiskPremium(1000)
      await creditOracle.setScore(owner.address, 255)
    })

    it('interest for single borrower and stable rate', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
    })

    it('interest for single borrower, rate changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditAgency.setRiskPremium(1500)
      await creditAgency.poke(tusdPool.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(250), 2)
      await creditAgency.setRiskPremium(2000)
      await creditAgency.poke(tusdPool.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(450), 2)
    })

    it('interest for single borrower, credit score changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditOracle.setScore(borrower.address, 200)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(227), 2)
      await creditOracle.setScore(borrower.address, 150)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(397), 2)
    })

    it('interest for multiple borrowers', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await creditAgency.connect(owner).borrow(tusdPool.address, 2000)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(0), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(200), 2)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 3000)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(200), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(600), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(400), 2)
    })

    it('interest for multiple borrowers, credit score changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await creditAgency.connect(owner).borrow(tusdPool.address, 2000)
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 3000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(600), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(400), 2)
      await creditOracle.setScore(borrower.address, 150) // 17% total rate
      await creditAgency.connect(borrower).borrow(tusdPool.address, 6000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(2300), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(600), 2)
    })

    it('after principal repayment', async () => {
      await setupBorrower(borrower, 255, 1000)
      await setupBorrower(borrower2, 154, 1000)
      await setupBorrower(owner, 154, 1000)
      await creditAgency.setRiskPremium(1000)

      await timeTravel(YEAR)

      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(165), 2)
      expect(await creditAgency.interest(tusdPool.address, borrower2.address)).to.be.closeTo(BigNumber.from(165), 2)

      await creditOracle.setScore(borrower2.address, 255)
      await creditAgency.updateCreditScore(tusdPool.address, borrower2.address)
      await tusd.connect(borrower2).approve(creditAgency.address, 1000)
      await creditAgency.connect(borrower2).repay(tusdPool.address, 665)
      expect(await creditAgency.borrowed(tusdPool.address, borrower2.address)).to.eq(500)

      await timeTravel(YEAR)

      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(165 * 2), 2)
      expect(await creditAgency.interest(tusdPool.address, borrower2.address)).to.be.closeTo(BigNumber.from(50), 2)
    })
  })
})
