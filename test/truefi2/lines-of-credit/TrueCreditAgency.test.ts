import { BigNumber, BigNumberish, Wallet } from 'ethers'
import {
  BorrowingMutex,
  DebtToken__factory,
  LoanFactory2,
  MockBorrowingMutex__factory,
  MockTrueCurrency,
  MockUsdc,
  PoolFactory,
  TimeAveragedBaseRateOracle,
  TrueCreditAgency,
  TrueCreditAgency__factory,
  TrueFiCreditOracle,
  TrueFiPool2,
  TrueLender2,
  TrueRateAdjuster,
} from 'contracts'
import {
  beforeEachWithFixture,
  DAY,
  expectScaledCloseTo,
  parseEth,
  parseUSDC,
  setupTruefi2,
  timeTravel as _timeTravel,
  updateRateOracle,
  YEAR,
} from 'utils'
import { setUtilization as _setUtilization } from 'utils/setUtilization'
import { expect, use } from 'chai'
import { AddressZero } from '@ethersproject/constants'
import { MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { setupDeploy } from 'scripts/utils'

use(solidity)

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
  let loanFactory: LoanFactory2
  let rateAdjuster: TrueRateAdjuster
  let lender: TrueLender2
  let creditOracle: TrueFiCreditOracle
  let tusdBaseRateOracle: TimeAveragedBaseRateOracle
  let mockSpotOracle: MockContract
  let borrowingMutex: BorrowingMutex
  let poolFactory: PoolFactory
  let timeTravel: (time: number) => void

  const MONTH = DAY * 31
  const PRECISION = BigNumber.from(10).pow(27)

  async function setupBorrower (borrower: Wallet, score: number, amount: BigNumberish) {
    await creditAgency.allowBorrower(borrower.address, true)
    await creditOracle.setScore(borrower.address, score)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))

    await creditAgency.connect(borrower).borrow(tusdPool.address, amount)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, borrower2] = wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)
    provider = _provider

    ; ({
      standardToken: tusd,
      standardPool: tusdPool,
      feeToken: usdc,
      feePool: usdcPool,
      loanFactory,
      lender,
      creditAgency,
      creditOracle,
      standardBaseRateOracle: tusdBaseRateOracle,
      mockSpotOracle,
      rateAdjuster,
      borrowingMutex,
      poolFactory,
    } = await setupTruefi2(owner, provider))

    await tusdPool.setCreditAgency(creditAgency.address)

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

    it('sets borrowingMutex', async () => {
      expect(await creditAgency.borrowingMutex()).to.equal(borrowingMutex.address)
    })

    it('sets poolFactory', async () => {
      expect(await creditAgency.poolFactory()).to.equal(poolFactory.address)
    })

    it('sets loanFactory', async () => {
      expect(await creditAgency.loanFactory()).to.equal(loanFactory.address)
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

  describe('setPoolFactory', () => {
    it('only owner can set pool factory', async () => {
      await expect(creditAgency.connect(borrower).setPoolFactory(poolFactory.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to zero address', async () => {
      await expect(creditAgency.setPoolFactory(AddressZero))
        .to.be.revertedWith('TrueCreditAgency: PoolFactory cannot be set to zero address')
    })

    it('pool factory is properly set', async () => {
      await creditAgency.setPoolFactory(poolFactory.address)
      expect(await creditAgency.poolFactory()).to.equal(poolFactory.address)
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.setPoolFactory(poolFactory.address))
        .to.emit(creditAgency, 'PoolFactoryChanged')
        .withArgs(poolFactory.address)
    })
  })

  describe('setLoanFactory', () => {
    it('only owner can set loan factory', async () => {
      await expect(creditAgency.connect(borrower).setLoanFactory(loanFactory.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to zero address', async () => {
      await expect(creditAgency.setLoanFactory(AddressZero))
        .to.be.revertedWith('TrueCreditAgency: LoanFactory cannot be set to zero address')
    })

    it('loan factory is properly set', async () => {
      await creditAgency.setLoanFactory(loanFactory.address)
      expect(await creditAgency.loanFactory()).to.equal(loanFactory.address)
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.setLoanFactory(loanFactory.address))
        .to.emit(creditAgency, 'LoanFactoryChanged')
        .withArgs(loanFactory.address)
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
      await expect(creditAgency.connect(borrower).allowBorrower(borrower.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('allowance is properly set', async () => {
      expect(await creditAgency.isBorrowerAllowed(borrower.address)).to.equal(false)
      await creditAgency.allowBorrower(borrower.address, true)
      expect(await creditAgency.isBorrowerAllowed(borrower.address)).to.equal(true)
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.allowBorrower(borrower.address, true))
        .to.emit(creditAgency, 'BorrowerAllowed')
        .withArgs(borrower.address, true)
    })
  })

  describe('totalBorrowed & poolValue', () => {
    beforeEach(async () => {
      await usdcPool.setCreditAgency(creditAgency.address)

      await usdc.mint(owner.address, parseUSDC(2e7))
      await usdc.approve(usdcPool.address, parseUSDC(2e7))
      await usdcPool.join(parseUSDC(2e7))
    })

    it('totalBorrowed returns total borrowed amount across all pools with 18 decimals precision', async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(100))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(500))
      expect(await creditAgency.totalBorrowed(borrower.address)).to.equal(parseEth(600))
    })

    it('poolValue remains unchanged after borrowing', async () => {
      expect(await tusdPool.poolValue()).to.equal(parseEth(1e7))
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(100))
      expect(await tusdPool.poolValue()).to.equal(parseEth(1e7))
    })

    it('poolValue scales with credit interest', async () => {
      expect(await tusdPool.poolValue()).to.equal(parseEth(1e7))
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseEth(100))
      await timeTravel(YEAR)
      expectScaledCloseTo(await tusdPool.poolValue(), parseEth(1e7).add(parseEth(1)))
    })
  })

  describe('singleCreditValue', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditOracle.setScore(owner.address, 255)
    })

    it('0 if a credit does not exist', async () => {
      expect(await creditAgency.singleCreditValue(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('just principal debt', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.singleCreditValue(tusdPool.address, borrower.address)).to.eq(1000)
    })

    it('principal debt and interest', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.singleCreditValue(tusdPool.address, borrower.address)).to.eq(1100)
    })

    it('after debt repayment', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await tusd.connect(borrower).approve(creditAgency.address, 600)
      await creditAgency.connect(borrower).repay(tusdPool.address, 600)
      expect(await creditAgency.singleCreditValue(tusdPool.address, borrower.address)).to.eq(500)
    })

    it('after credit score update', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await creditOracle.setScore(borrower.address, 150)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      expect(await creditAgency.singleCreditValue(tusdPool.address, borrower.address)).to.eq(1100)
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
    beforeEach(async () => {
      await creditOracle.setScore(borrower.address, 191) // adjustment = 0.8051
      await creditAgency.allowBorrower(borrower.address, true)

      await usdcPool.setCreditAgency(creditAgency.address)

      await usdc.mint(owner.address, parseUSDC(2e7))
      await usdc.approve(usdcPool.address, parseUSDC(2e7))
      await usdcPool.join(parseUSDC(2e7))
    })

    it('borrow amount is limited by borrower limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))
      expect(await creditAgency.borrowLimit(tusdPool.address, borrower.address)).to.equal(parseEth(80.51))
      expect(await creditAgency.borrowLimit(usdcPool.address, borrower.address)).to.equal(parseEth(80.51))
    })

    it('borrow amount is limited by total TVL', async () => {
      await usdcPool.liquidExit(parseUSDC(19e6))
      const maxTVLLimit = (await poolFactory.supportedPoolsTVL()).mul(15).div(100)
      expect(await creditAgency.borrowLimit(tusdPool.address, borrower.address)).to.equal(maxTVLLimit.mul(8051).div(10000))
    })

    it('borrow amount is limited by a single pool value', async () => {
      expect(await creditAgency.borrowLimit(usdcPool.address, borrower.address)).to.equal(parseEth(2e7).mul(15).div(100))
    })

    it('cannot borrow more than 15% of a single pool in total', async () => {
      const expectLimitCloseTo = async (expectedAmount: BigNumber) =>
        expect(expectedAmount.sub(await creditAgency.borrowLimit(usdcPool.address, borrower.address))).to.be.lte(parseEth(1))
      await expectLimitCloseTo(parseEth(3e6))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(2e6))
      await expectLimitCloseTo(parseEth(1e6))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(5e5))
      await expectLimitCloseTo(parseEth(5e5))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(5e5))
      await expectLimitCloseTo(parseEth(0))
    })

    it('borrow limit is 0 if credit limit is below the borrowed amount', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))
      await creditAgency.connect(borrower).borrow(usdcPool.address, parseUSDC(80))
      expect(await creditAgency.borrowLimit(usdcPool.address, borrower.address)).to.be.gt(0)
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(95))
      expect(await creditAgency.borrowLimit(usdcPool.address, borrower.address)).to.equal(0)
    })
  })

  describe('Borrowing', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
    })

    it('borrows funds from the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(1000)
    })

    it('fails if borrower is not whitelisted', async () => {
      await creditAgency.allowBorrower(borrower.address, false)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Sender is not allowed to borrow')
    })

    it('fails if borrower has credit score below required', async () => {
      await creditOracle.setScore(borrower.address, 191)
      await creditAgency.setMinCreditScore(192)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Borrower has credit score below minimum')
    })

    it('fails if the credit score was not updated for too long', async () => {
      await creditOracle.connect(owner).setEligibleForDuration(borrower.address, DAY * 15)
      await timeTravel(DAY * 16)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Sender not eligible to borrow')
    })

    it('fails if borrower has missed the repay time', async () => {
      await creditAgency.setInterestRepaymentPeriod(DAY * 15)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 500)
      await timeTravel(DAY * 16)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 500))
        .to.be.revertedWith('TrueCreditAgency: Sender has overdue interest in this pool')
    })

    it('fails if borrower mutex is already locked', async () => {
      await borrowingMutex.allowLocker(owner.address, true)
      await borrowingMutex.lock(borrower.address, owner.address)

      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('BorrowingMutex: Borrower is already locked')
    })

    it('fails if borrower mutex is already locked and borrower has some debt', async () => {
      const deployContract = setupDeploy(owner)
      const faultyCreditAgency = await deployContract(TrueCreditAgency__factory)
      const faultyBorrowingMutex = await deployContract(MockBorrowingMutex__factory)

      await faultyCreditAgency.initialize(creditOracle.address, rateAdjuster.address, faultyBorrowingMutex.address, poolFactory.address, loanFactory.address)
      await tusdPool.setCreditAgency(faultyCreditAgency.address)
      await faultyCreditAgency.allowBorrower(borrower.address, true)

      await faultyCreditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await faultyBorrowingMutex.unlock(borrower.address)
      await faultyBorrowingMutex.lock(borrower.address, owner.address)

      await expect(faultyCreditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Borrower cannot open two simultaneous debt positions')
    })

    it('cannot borrow from the pool that is not whitelisted', async () => {
      await poolFactory.unsupportPool(tusdPool.address)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: The pool is not supported for borrowing')
    })

    it('updates nextInterestRepayTime', async () => {
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(0)
      const tx = await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('zeroes out overBorrowLimitTime', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await creditOracle.setMaxBorrowerLimit(borrower.address, 0)
      const tx = await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(timestamp)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('locks mutex', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await borrowingMutex.locker(borrower.address)).to.eq(creditAgency.address)
    })

    it('does not update nextInterestRepayTime on debt increase', async () => {
      const tx = await creditAgency.connect(borrower).borrow(tusdPool.address, 500)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
      await creditAgency.connect(borrower).borrow(tusdPool.address, 500)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('cannot borrow over the borrow limit', async () => {
      await creditAgency.allowBorrower(borrower.address, true)
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

    it('should be possible to borrow over 1 month after full repayment', async () => {
      await creditOracle.connect(owner).setEligibleForDuration(borrower.address, DAY * 90)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1200)
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      await timeTravel(DAY * 60)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000)).to.be.not.reverted
    })
  })

  describe('payInterest', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditOracle.setScore(borrower.address, 255)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1000)
      await timeTravel(YEAR)
    })

    it('pays interest to the pool', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)

      expect(await tusd.balanceOf(borrower.address)).to.be.closeTo(BigNumber.from(900), 2)
      expect(await tusd.balanceOf(tusdPool.address)).to.be.closeTo(parseEth(1e7).sub(900), 2)
    })

    it('increases borrowerTotalPaidInterest', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('pays close to nothing on second call', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('updates nextInterestRepayTime', async () => {
      const tx = await creditAgency.connect(borrower).payInterest(tusdPool.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(timestamp.add(MONTH))
    })

    it('updates poolTotalPaidInterest', async () => {
      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.poolTotalPaidInterest(tusdPool.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('updates poolTotalPaidInterest with 2 separate LoC', async () => {
      await creditAgency.allowBorrower(owner.address, true)
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.connect(owner).borrow(tusdPool.address, 1000)
      await tusd.connect(owner).approve(creditAgency.address, 1000)
      await timeTravel(YEAR)

      await creditAgency.connect(borrower).payInterest(tusdPool.address)
      expect(await creditAgency.poolTotalPaidInterest(tusdPool.address)).to.be.closeTo(BigNumber.from(200), 2)

      await creditAgency.connect(owner).payInterest(tusdPool.address)
      expect(await creditAgency.poolTotalPaidInterest(tusdPool.address)).to.be.closeTo(BigNumber.from(300), 2)
    })

    it('emits event', async () => {
      await expect(creditAgency.connect(borrower).payInterest(tusdPool.address))
        .to.emit(creditAgency, 'InterestPaid')
        .withArgs(tusdPool.address, borrower.address, 100)
    })
  })

  describe('repay', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
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

    it('updates borrowerTotalPaidInterest on whole interest repayment', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 500)

      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.poolTotalPaidInterest(tusdPool.address)).to.be.closeTo(BigNumber.from(100), 2)
    })

    it('updates borrowerTotalPaidInterest on partial interest repayment', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 50)

      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(50), 2)
    })

    it('updates poolTotalInterest', async () => {
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).repay(tusdPool.address, 200)

      expectScaledCloseTo(await creditAgency.poolTotalInterest(tusdPool.address), BigNumber.from(100).mul(PRECISION))
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

    it('zeroes out overBorrowLimitTime when brought under limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, 600)
      const tx = await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)

      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(timestamp)
      await creditAgency.connect(borrower).repay(tusdPool.address, 400)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('sets nonzero overBorrowLimitTime when above limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, 600)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
      const tx = await creditAgency.connect(borrower).repay(tusdPool.address, 399)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(timestamp)
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
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
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

      expect(await creditAgency.borrowerTotalPaidInterest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.poolTotalPaidInterest(tusdPool.address)).to.be.closeTo(BigNumber.from(100), 2)
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

    it('sets nextInterestRepayTime to 0', async () => {
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      expect(await creditAgency.nextInterestRepayTime(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('unlocks mutex', async () => {
      expect(await borrowingMutex.locker(borrower.address)).to.eq(creditAgency.address)
      await creditAgency.connect(borrower).repayInFull(tusdPool.address)
      expect(await borrowingMutex.locker(borrower.address)).to.eq(AddressZero)
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
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.allowBorrower(owner.address, true)
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
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.allowBorrower(owner.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditOracle.connect(owner).setCreditUpdatePeriod(YEAR * 10)
      await creditOracle.setScore(owner.address, 255)
      await creditOracle.setScore(borrower.address, 255)
      await creditAgency.setInterestRepaymentPeriod(YEAR * 10)
      await creditAgency.setMinCreditScore(150)
    })

    it('interest for single borrower and stable rate', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
    })

    it('interest for single borrower, risk premium changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await rateAdjuster.setRiskPremium(1200)
      await creditAgency.poke(tusdPool.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(250), 2)
      await rateAdjuster.setRiskPremium(1700)
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

    it('interest for single borrower, secured rate changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, parseUSDC(36500))
      await updateRateOracle(tusdBaseRateOracle, DAY, provider)
      await creditAgency.poke(tusdPool.address)

      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(parseUSDC(10), 1e5) // 10 = 10% * 36500 / 365

      await mockSpotOracle.mock.getRate.withArgs(tusd.address).returns(1000) // this will increase average by 1%
      await updateRateOracle(tusdBaseRateOracle, DAY, provider)
      await creditAgency.poke(tusdPool.address)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(parseUSDC(20), 1e5) // 20 = 2*(10% * 36500 / 365)

      await timeTravel(DAY)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(parseUSDC(31), 1e5) // 31 = 2*(10% * 36500 / 365) + (11% * 36500 / 365)
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

    it('principal repayment after credit score change', async () => {
      await setupBorrower(borrower, 255, 1000)
      await setupBorrower(borrower2, 154, 1000)
      await setupBorrower(owner, 154, 1000)
      await rateAdjuster.setRiskPremium(700)

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

    it('principal repayment after credit score change into new bucket', async () => {
      await setupBorrower(borrower, 255, 1000)
      await setupBorrower(borrower2, 255, 1000)
      await rateAdjuster.setRiskPremium(700)

      await timeTravel(YEAR)

      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.interest(tusdPool.address, borrower2.address)).to.be.closeTo(BigNumber.from(100), 2)

      await creditOracle.setScore(borrower2.address, 154)
      await creditAgency.updateCreditScore(tusdPool.address, borrower2.address)
      await tusd.connect(borrower2).approve(creditAgency.address, 1000)
      await creditAgency.connect(borrower2).repay(tusdPool.address, 600)
      expect(await creditAgency.borrowed(tusdPool.address, borrower2.address)).to.eq(500)

      await timeTravel(YEAR)

      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, borrower2.address)).to.be.closeTo(BigNumber.from(82), 2)
    })
  })

  describe('enterDefault', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 2000)
    })

    describe('reverts if borrower', () => {
      it('pool is not supported', async () => {
        await poolFactory.unsupportPool(tusdPool.address)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.be.revertedWith('TrueCreditAgency: The pool is not supported for borrowing')
      })

      it('pool is not supported', async () => {
        await poolFactory.unsupportPool(tusdPool.address)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.be.revertedWith('TrueCreditAgency: The pool is not supported for borrowing')
      })

      it('has no debt', async () => {
        await creditAgency.connect(borrower).repayInFull(tusdPool.address)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.be.revertedWith('TrueCreditAgency: Cannot default a borrower with no open debt position')
      })

      it('has no reason to default', async () => {
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.be.revertedWith('TrueCreditAgency: Borrower has no reason to enter default at this time')
      })
    })

    describe('because borrower', () => {
      enum DefaultReason { NotAllowed, Ineligible, BelowMinScore, InterestOverdue, TimeLimitExceeded }

      it('is not allowed to use LoCs', async () => {
        await creditAgency.allowBorrower(borrower.address, false)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.emit(creditAgency, 'EnteredDefault')
          .withArgs(borrower.address, DefaultReason.NotAllowed)
      })

      it('has ineligible credit', async () => {
        await creditOracle.setIneligible(borrower.address)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.emit(creditAgency, 'EnteredDefault')
          .withArgs(borrower.address, DefaultReason.Ineligible)
      })

      it('is below min score', async () => {
        await creditAgency.setMinCreditScore(191)
        await creditOracle.setScore(borrower.address, 190)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.emit(creditAgency, 'EnteredDefault')
          .withArgs(borrower.address, DefaultReason.BelowMinScore)
      })

      it('has overdue interest', async () => {
        await creditOracle.setEligibleForDuration(borrower.address, YEAR)
        await timeTravel(MONTH + DAY * 3 + 1)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.emit(creditAgency, 'EnteredDefault')
          .withArgs(borrower.address, DefaultReason.InterestOverdue)
      })

      it('has exceeded borrow time limit', async () => {
        await creditOracle.setMaxBorrowerLimit(borrower.address, 0)
        await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
        await timeTravel(DAY * 3 + 1)
        await expect(creditAgency.enterDefault(tusdPool.address, borrower.address))
          .to.emit(creditAgency, 'EnteredDefault')
          .withArgs(borrower.address, DefaultReason.TimeLimitExceeded)
      })
    })

    describe('makes LoC repaid from TCA point of view', () => {
      beforeEach(async () => {
        await timeTravel(MONTH + DAY * 3 + 1)
      })

      it('reduces principal debt to 0', async () => {
        expect(await creditAgency.borrowed(tusdPool.address, borrower.address)).to.eq(1000)
        await creditAgency.enterDefault(tusdPool.address, borrower.address)
        expect(await creditAgency.borrowed(tusdPool.address, borrower.address)).to.eq(0)
      })

      it('reduces interest to 0', async () => {
        expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.gt(0)
        await creditAgency.enterDefault(tusdPool.address, borrower.address)
        expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.eq(0)
      })
    })

    describe.only('DebtTokens', () => {
      const collectDebtTokensFromDefault = async (borrower: Wallet) => {
        const tx = await creditAgency.enterDefault(borrower.address)
        let debtTokens = []
        for (let event of (await tx.wait()).events) {
          console.log('AAAAAAAAAAAAAAAAAAAAAAAA')
          console.log(event)
          // ;({ contractAddress } = event.args)
          // debtTokens.push(await DebtToken__factory.connect(contractAddress, owner))
        }
        return debtTokens
      }

      beforeEach(async () => {
        await timeTravel(MONTH + DAY * 3 + 1)
      })

      it('creates DebtToken for borrowed pool', async () => {
        const debtTokens = await collectDebtTokensFromDefault(borrower)
        expect(await debtTokens[0].pool()).to.eq(tusdPool.address)
        expect(await debtTokens[0].borrower()).to.eq(borrower.address)
        expect(await debtTokens[0].debt()).to.eq(1000)
      })

      it('does not create any DebtTokens for unused pool', async () => {
        const debtTokens = await collectDebtTokensFromDefault(borrower)
        for (let debtToken of debtTokens) {
          expect(await debtToken.pool()).to.not.eq(usdcPool.address)
        }
      })
    })
  })

  describe('pokeBorrowLimitTimer', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 2000)
    })

    it('zeroes out overBorrowLimitTime when brought under limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, 500)
      await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)

      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.be.gt(0)
      await creditOracle.setMaxBorrowerLimit(borrower.address, 10_000)
      await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
    })

    it('sets overBorrowLimitTime when borrower is first over limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, 500)

      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
      const tx = await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(timestamp)
    })

    it('does not update overBorrowLimitTime when borrower remains over limit', async () => {
      await creditOracle.setMaxBorrowerLimit(borrower.address, 500)

      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(0)
      const tx = await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      const timestamp = BigNumber.from((await provider.getBlock(tx.blockNumber)).timestamp)
      timeTravel(YEAR)
      await creditAgency.pokeBorrowLimitTimer(tusdPool.address, borrower.address)
      expect(await creditAgency.overBorrowLimitTime(tusdPool.address, borrower.address)).to.eq(timestamp)
    })
  })

  describe('poolCreditValue', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.allowBorrower(owner.address, true)
      await rateAdjuster.setRiskPremium(700)
      await creditOracle.setScore(borrower.address, 255)
    })

    it('one line opened', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1000), 2)

      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1100), 2)
    })

    it('two lines, same credit score', async () => {
      await creditOracle.setScore(owner.address, 255)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await creditAgency.connect(owner).borrow(tusdPool.address, 500)

      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1500), 2)

      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1650), 2)
    })

    it('two lines, different credit score', async () => {
      await creditOracle.setScore(owner.address, 254)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await creditAgency.connect(owner).borrow(tusdPool.address, 500)

      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1500), 2)

      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1650), 2)
    })

    it('gets reduced after repayment', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(1100), 2)

      await tusd.connect(borrower).approve(creditAgency.address, 600)
      await creditAgency.connect(borrower).repay(tusdPool.address, 600)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(500), 2)
    })

    it('complex 2 borrower scenario', async () => {
      await tusd.approve(creditAgency.address, parseEth(1e7))
      await creditOracle.setScore(owner.address, 200) // rate = 10% + 2,75% = 12,75%
      await creditAgency.connect(borrower).borrow(tusdPool.address, 10000)
      await creditAgency.connect(owner).borrow(tusdPool.address, 10000)
      await timeTravel(YEAR)

      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(22275), 2)

      await creditAgency.connect(owner).payInterest(tusdPool.address)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(21000), 2)

      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(23275), 2)

      await creditOracle.setScore(owner.address, 255)
      await creditAgency.updateCreditScore(tusdPool.address, owner.address)

      await timeTravel(YEAR)
      expect(await creditAgency.poolCreditValue(tusdPool.address)).to.be.closeTo(BigNumber.from(25275), 2)
    })
  })

  describe('rate adjuster integration', () => {
    beforeEach(async () => {
      await setupBorrower(owner, 255, 0)
      await creditAgency.connect(owner).repayInFull(tusdPool.address)
      await setupBorrower(borrower2, 255, 0)
      await creditAgency.connect(borrower2).repayInFull(tusdPool.address)
    })

    const setUtilization = (utilization: number) => (
      _setUtilization(
        tusd,
        loanFactory,
        owner,
        borrower2,
        lender,
        owner,
        tusdPool,
        utilization,
      )
    )

    describe('setUtilization', () => {
      [0, 10, 25, 75, 100].map((utilization) => {
        it(`sets utilization to ${utilization} percent`, async () => {
          await setUtilization(utilization)
          const poolValue = await tusdPool.poolValue()
          const liquidValue = await tusdPool.liquidValue()
          const poolUtilization = poolValue.sub(liquidValue).mul(10_000).div(poolValue)
          expect(poolUtilization).to.eq(utilization * 100)
        })
      })
    })

    it('utilizationAdjustmentRate', async () => {
      await setUtilization(70)
      expect(await creditAgency.utilizationAdjustmentRate(tusdPool.address)).to.eq(505)
      expect('utilizationAdjustmentRate').to.be.calledOnContractWith(rateAdjuster, [tusdPool.address, 0])
    })

    it('currentRate', async () => {
      await rateAdjuster.setRiskPremium(100)
      await creditOracle.setScore(borrower.address, 223)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      await setUtilization(50)
      const expectedCurrentRate = 693 // 300 + 100 + 143 + 150
      expect(await creditAgency.currentRate(tusdPool.address, borrower.address)).to.eq(expectedCurrentRate)
      expect('rate').to.be.calledOnContractWith(rateAdjuster, [tusdPool.address, 223, 0])
    })

    it('creditScoreAdjustmentRate', async () => {
      await creditOracle.setScore(borrower.address, 223)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      expect(await creditAgency.creditScoreAdjustmentRate(tusdPool.address, borrower.address)).to.equal(143)
      expect('creditScoreAdjustmentRate').to.be.calledOnContractWith(rateAdjuster, [223])
    })
  })
})
