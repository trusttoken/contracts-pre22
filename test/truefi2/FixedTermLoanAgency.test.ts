import { expect, use } from 'chai'
import {
  beforeEachWithFixture,
  DAY,
  parseEth,
  parseUSDC,
  setupTruefi2,
  timeTravel as _timeTravel,
  extractLoanTokenAddress as _extractLoanTokenAddress,
  parseTRU,
} from 'utils'
import { deployContract } from 'scripts/utils/deployContract'
import {
  BorrowingMutex,
  FixedTermLoanAgency,
  LoanFactory2,
  LoanToken2,
  Mock1InchV3,
  Mock1InchV3__factory,
  MockErc20Token,
  MockErc20Token__factory,
  MockTrueFiPoolOracle,
  MockUsdc,
  PoolFactory,
  StkTruToken,
  TimeAveragedBaseRateOracle,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  RateModel,
  MockTrueCurrency,
  StakingVault,
  BorrowingMutex__factory,
} from 'contracts'

import { BorrowingMutexJson, LoanToken2Json, Mock1InchV3Json } from 'build'

import { deployMockContract, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { BigNumber, BigNumberish, Contract, ContractTransaction, utils, Wallet } from 'ethers'

use(solidity)

describe('FixedTermLoanAgency', () => {
  let owner: Wallet
  let borrower: Wallet
  let borrower2: Wallet

  let loanFactory: LoanFactory2
  let pool1: TrueFiPool2
  let pool2: TrueFiPool2
  let feePool: TrueFiPool2
  let poolOracle: MockTrueFiPoolOracle

  let ftlAgency: FixedTermLoanAgency
  let creditOracle: TrueFiCreditOracle

  let counterfeitPool: TrueFiPool2
  let token1: MockErc20Token
  let token2: MockErc20Token

  let poolFactory: PoolFactory

  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let usdc: MockUsdc
  let oneInch: Mock1InchV3
  let borrowingMutex: BorrowingMutex
  let rateModel: RateModel
  let baseRateOracle: TimeAveragedBaseRateOracle
  let stakingVault: StakingVault

  const YEAR = DAY * 365

  let timeTravel: (time: number) => void
  let extractLoanTokenAddress: (pendingTx: Promise<ContractTransaction>) => Promise<LoanToken2>

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, borrower, borrower2] = wallets)
    timeTravel = (time: number) => _timeTravel(_provider, time)
    extractLoanTokenAddress = (pendingTx: Promise<ContractTransaction>) =>
      _extractLoanTokenAddress(pendingTx, owner, loanFactory)

    oneInch = await new Mock1InchV3__factory(owner).deploy()

    ; ({
      tru,
      loanFactory,
      feePool,
      standardTokenOracle: poolOracle,
      poolFactory,
      stkTru,
      feeToken: usdc,
      ftlAgency,
      creditOracle,
      borrowingMutex,
      rateModel,
      standardBaseRateOracle: baseRateOracle,
      stakingVault,
    } = await setupTruefi2(owner, _provider, { oneInch: oneInch }))

    token1 = await deployContract(owner, MockErc20Token__factory)
    token2 = await deployContract(owner, MockErc20Token__factory)

    await poolFactory.allowToken(token1.address, true)
    await poolFactory.allowToken(token2.address, true)

    await poolFactory.createPool(token1.address)
    await poolFactory.createPool(token2.address)

    pool1 = TrueFiPool2__factory.connect(await poolFactory.pool(token1.address), owner)
    pool2 = TrueFiPool2__factory.connect(await poolFactory.pool(token2.address), owner)

    await poolFactory.supportPool(pool1.address)
    await poolFactory.supportPool(pool2.address)

    counterfeitPool = await deployContract(owner, TrueFiPool2__factory)
    await counterfeitPool.initialize(token1.address, ftlAgency.address, AddressZero, loanFactory.address, owner.address)

    await pool1.setOracle(poolOracle.address)
    await pool2.setOracle(poolOracle.address)
    await rateModel.setBaseRateOracle(pool1.address, baseRateOracle.address)
    await rateModel.setBaseRateOracle(pool2.address, baseRateOracle.address)

    await ftlAgency.setFeePool(feePool.address)
    await ftlAgency.allowBorrower(borrower.address)
    await ftlAgency.allowBorrower(borrower2.address)

    await token1.mint(owner.address, parseEth(1e7))
    await token2.mint(owner.address, parseEth(1e7))
    await usdc.mint(owner.address, parseUSDC(1e7))
    await token1.approve(pool1.address, parseEth(1e7))
    await token2.approve(pool2.address, parseEth(1e7))
    await usdc.approve(feePool.address, parseUSDC(1e7))
    await pool1.join(parseEth(1e7))
    await pool2.join(parseEth(1e7))
    await feePool.join(parseUSDC(1e7))

    await creditOracle.setCreditUpdatePeriod(YEAR)
    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(1e8))
    await creditOracle.setScore(borrower2.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower2.address, parseEth(1e8))
  })

  describe('Initializer', () => {
    it('sets the staking pool address', async () => {
      expect(await ftlAgency.stakingPool()).to.equal(stkTru.address)
    })

    it('sets the pool factory address', async () => {
      expect(await ftlAgency.poolFactory()).to.equal(poolFactory.address)
    })

    it('sets credit oracle address', async () => {
      expect(await ftlAgency.creditOracle()).to.equal(creditOracle.address)
    })

    it('sets loan factory address', async () => {
      expect(await ftlAgency.loanFactory()).to.equal(loanFactory.address)
    })

    it('default params', async () => {
      expect(await ftlAgency.maxLoans()).to.equal(100)
      expect(await ftlAgency.maxLoanTerm()).to.equal(YEAR * 10)
      expect(await ftlAgency.longTermLoanThreshold()).to.equal(YEAR * 10)
      expect(await ftlAgency.longTermLoanScoreThreshold()).to.equal(200)
    })
  })

  describe('Parameters set up', () => {
    describe('setMaxLoanTerm', () => {
      it('changes maxLoanTerm', async () => {
        await ftlAgency.setMaxLoanTerm(DAY)
        expect(await ftlAgency.maxLoanTerm()).to.equal(DAY)
      })

      it('emits MaxLoanTermChanged', async () => {
        await expect(ftlAgency.setMaxLoanTerm(DAY))
          .to.emit(ftlAgency, 'MaxLoanTermChanged').withArgs(DAY)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setMaxLoanTerm(DAY))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setLongTermLoanThreshold', () => {
      it('changes longTermLoanThreshold', async () => {
        await ftlAgency.setLongTermLoanThreshold(DAY)
        expect(await ftlAgency.longTermLoanThreshold()).to.equal(DAY)
      })

      it('emits LongTermLoanThresholdChanged', async () => {
        await expect(ftlAgency.setLongTermLoanThreshold(DAY))
          .to.emit(ftlAgency, 'LongTermLoanThresholdChanged').withArgs(DAY)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setLongTermLoanThreshold(DAY))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setLongTermLoanScoreThreshold', () => {
      it('changes longTermLoanScoreThreshold', async () => {
        await ftlAgency.setLongTermLoanScoreThreshold(100)
        expect(await ftlAgency.longTermLoanScoreThreshold()).to.equal(100)
      })

      it('emits LongTermLoanScoreThresholdChanged', async () => {
        await expect(ftlAgency.setLongTermLoanScoreThreshold(100))
          .to.emit(ftlAgency, 'LongTermLoanScoreThresholdChanged').withArgs(100)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setLongTermLoanScoreThreshold(100))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setFee', () => {
      it('changes fee', async () => {
        await ftlAgency.setFee(1234)
        expect(await ftlAgency.fee()).to.equal(1234)
      })

      it('forbids setting above 100%', async () => {
        await expect(ftlAgency.setFee(10001))
          .to.be.revertedWith('FixedTermLoanAgency: fee cannot be more than 100%')
      })

      it('emits FeeChanged', async () => {
        await expect(ftlAgency.setFee(1234))
          .to.emit(ftlAgency, 'FeeChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setFee(1234))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setFeePool', () => {
      it('changes feePool', async () => {
        await ftlAgency.setFeePool(pool2.address)
        expect(await ftlAgency.feePool()).to.equal(pool2.address)
      })

      it('changes feeToken', async () => {
        await ftlAgency.setFeePool(pool2.address)
        expect(await ftlAgency.feeToken()).to.equal(token2.address)
      })

      it('emits FeePoolChanged', async () => {
        await expect(ftlAgency.setFeePool(pool2.address))
          .to.emit(ftlAgency, 'FeePoolChanged').withArgs(pool2.address)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setFeePool(pool2.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setCreditOracle', () => {
      let newOracle: TrueFiCreditOracle

      beforeEach(async () => {
        newOracle = await deployContract(owner, TrueFiCreditOracle__factory)
      })

      it('changes creditOracle', async () => {
        await ftlAgency.setCreditOracle(newOracle.address)
        expect(await ftlAgency.creditOracle()).to.equal(newOracle.address)
      })

      it('emits CreditOracleChanged', async () => {
        await expect(ftlAgency.setCreditOracle(newOracle.address))
          .to.emit(ftlAgency, 'CreditOracleChanged').withArgs(newOracle.address)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setCreditOracle(newOracle.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('cannot set creditOracle to zero address', async () => {
        await expect(ftlAgency.setCreditOracle(AddressZero))
          .to.be.revertedWith('FixedTermLoanAgency: CreditOracle cannot be set to zero address')
      })
    })

    describe('setBorrowingMutex', () => {
      let fakeBorrowingMutex: BorrowingMutex

      beforeEach(async () => {
        fakeBorrowingMutex = await deployContract(owner, BorrowingMutex__factory)
      })

      it('changes borrowingMutex', async () => {
        await ftlAgency.setBorrowingMutex(fakeBorrowingMutex.address)
        expect(await ftlAgency.borrowingMutex()).to.equal(fakeBorrowingMutex.address)
      })

      it('emits BorrowingMutexChanged', async () => {
        await expect(ftlAgency.setBorrowingMutex(fakeBorrowingMutex.address))
          .to.emit(ftlAgency, 'BorrowingMutexChanged').withArgs(fakeBorrowingMutex.address)
      })

      it('must be called by owner', async () => {
        await expect(ftlAgency.connect(borrower).setBorrowingMutex(fakeBorrowingMutex.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('cannot set borrowingMutex to zero address', async () => {
        await expect(ftlAgency.setBorrowingMutex(AddressZero))
          .to.be.revertedWith('FixedTermLoanAgency: BorrowingMutex cannot be set to zero address')
      })
    })

    describe('Setting loans limit', () => {
      it('reverts when performed by non-owner', async () => {
        await expect(ftlAgency.connect(borrower).setLoansLimit(0))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('changes loans limit', async () => {
        await ftlAgency.setLoansLimit(3)
        expect(await ftlAgency.maxLoans()).eq(3)
      })

      it('emits event', async () => {
        await expect(ftlAgency.setLoansLimit(2))
          .to.emit(ftlAgency, 'LoansLimitChanged')
          .withArgs(2)
      })
    })

    describe('Borrower allowance', () => {
      it('only owner can allow borrowers', async () => {
        await expect(ftlAgency.connect(borrower).allowBorrower(borrower.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
        await expect(ftlAgency.connect(borrower).blockBorrower(borrower.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('allowance is properly set', async () => {
        await ftlAgency.blockBorrower(borrower.address)
        expect(await ftlAgency.isBorrowerAllowed(borrower.address)).to.equal(false)
        await ftlAgency.allowBorrower(borrower.address)
        expect(await ftlAgency.isBorrowerAllowed(borrower.address)).to.equal(true)
        await ftlAgency.blockBorrower(borrower.address)
        expect(await ftlAgency.isBorrowerAllowed(borrower.address)).to.equal(false)
      })

      it('emits a proper event', async () => {
        await expect(ftlAgency.allowBorrower(borrower.address))
          .to.emit(ftlAgency, 'BorrowerAllowed')
          .withArgs(borrower.address)
        await expect(ftlAgency.blockBorrower(borrower.address))
          .to.emit(ftlAgency, 'BorrowerBlocked')
          .withArgs(borrower.address)
      })
    })
  })

  const borrow = async (connectedBorrower: Wallet, pool: Contract, amount: number | BigNumber, term: number) =>
    ftlAgency.connect(connectedBorrower).borrow(pool.address, amount, term, await ftlAgency.rate(pool.address, connectedBorrower.address, amount, term))

  describe('Borrowing', () => {
    describe('reverts if', () => {
      it('borrower is not allowed', async () => {
        await ftlAgency.blockBorrower(borrower.address)
        await expect(borrow(borrower, pool1, 100000, YEAR)).to.be.revertedWith('FixedTermLoanAgency: Sender is not allowed to borrow')
      })

      it('loan was created for unknown pool', async () => {
        await expect(ftlAgency.connect(borrower).borrow(counterfeitPool.address, 100000, YEAR, 1000)).to.be.revertedWith('FixedTermLoanAgency: Pool not supported by the factory')
      })

      it('loan was created for unsupported pool', async () => {
        await poolFactory.unsupportPool(pool1.address)
        await expect(borrow(borrower, pool1, 100000, YEAR)).to.be.revertedWith('FixedTermLoanAgency: Pool not supported by the factory')
      })

      it('apy is higher than maxApy', async () => {
        await expect(ftlAgency.connect(borrower).borrow(pool1.address, 100000, YEAR, 100)).to.be.revertedWith('FixedTermLoanAgency: Calculated apy is higher than max apy')
      })

      it('there are too many loans for given pool', async () => {
        await ftlAgency.setLoansLimit(1)
        await borrow(borrower2, pool1, 100_000, DAY)
        await expect(borrow(borrower, pool1, 100000, YEAR)).to.be.revertedWith('FixedTermLoanAgency: Loans number has reached the limit')
      })

      it('loan term exceeds max term', async () => {
        await ftlAgency.setLongTermLoanThreshold(DAY * 365 - 1)
        await ftlAgency.setMaxLoanTerm(DAY * 365 - 1)

        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Loan\'s term is too long')
      })

      it('borrower has too low score for long term loan', async () => {
        await creditOracle.setScore(borrower.address, 199)
        await ftlAgency.setLongTermLoanThreshold(DAY)

        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Credit score is too low for loan\'s term')
      })

      it('amount to borrow exceeds borrow limit', async () => {
        const amountToBorrow = parseEth(1e7).mul(15).div(100).add(1) // 15% of pool value + 1
        await expect(borrow(borrower, pool1, amountToBorrow, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Loan amount cannot exceed borrow limit')
      })

      it('amount to borrow exceeds borrow limit due to decimals mismatch', async () => {
        const usdcPool = feePool

        expect(await ftlAgency.borrowLimit(usdcPool.address, borrower.address)).to.be.lt(parseEth(1e7))
        await expect(borrow(borrower, usdcPool, parseUSDC(1e7), YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Loan amount cannot exceed borrow limit')
      })

      it('taking new loans is locked by mutex', async () => {
        await borrowingMutex.allowLocker(owner.address, true)
        await borrowingMutex.lock(borrower.address, owner.address)
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: There is an ongoing loan or credit line')
      })

      it('borrower is not eligible', async () => {
        await creditOracle.setIneligible(borrower.address)
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Sender is not eligible for loan')
        await creditOracle.setOnHold(borrower.address)
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Sender is not eligible for loan')
      })
    })

    describe('all requirements are met', () => {
      it('borrower is allowed to have a long term loan', async () => {
        await creditOracle.setScore(borrower.address, 200)
        await ftlAgency.setLongTermLoanThreshold(DAY)
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .not.to.be.reverted
      })

      it('borrows tokens from pool', async () => {
        const poolValueBefore = await pool1.liquidValue()
        const borrowedAmount = 100_000
        await borrow(borrower, pool1, borrowedAmount, YEAR)
        expect(poolValueBefore.sub(await pool1.liquidValue())).to.eq(borrowedAmount)
      })

      it('borrows receivedAmount from pool and transfers to the borrower', async () => {
        const tx = borrow(borrower, pool1, 100000, YEAR)
        await expect(tx)
          .to.emit(token1, 'Transfer')
          .withArgs(pool1.address, ftlAgency.address, 100_000)
          .and.to.emit(token1, 'Transfer')
          .withArgs(ftlAgency.address, borrower.address, 100_000)
        expect(await token1.balanceOf(borrower.address)).to.equal(100_000)
      })

      it('locks borrowing mutex', async () => {
        const loan = await extractLoanTokenAddress(borrow(borrower, pool1, 100000, YEAR))
        expect(await borrowingMutex.locker(borrower.address)).to.equal(loan.address)
      })

      it('can increase max borrow limit after staking TRU', async () => {
        await creditOracle.setMaxBorrowerLimit(borrower.address, 90000)
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .to.be.revertedWith('FixedTermLoanAgency: Loan amount cannot exceed borrow limit')
        await tru.mint(borrower.address, parseTRU(100))
        await tru.connect(borrower).approve(stakingVault.address, parseTRU(100))
        await stakingVault.connect(borrower).stake(parseTRU(100))
        await expect(borrow(borrower, pool1, 100000, YEAR))
          .not.to.be.reverted
      })

      it('emits event', async () => {
        const tx = borrow(borrower, pool1, 100000, YEAR)
        const newLoan = await extractLoanTokenAddress(tx)
        await expect(tx)
          .to.emit(ftlAgency, 'Funded')
          .withArgs(pool1.address, newLoan.address, 100000)
      })
    })
  })

  describe('totalBorrowed', () => {
    it('is 0 when no loans are taken by the borrower', async () => {
      expect(await ftlAgency.totalBorrowed(borrower.address, 18)).to.equal(0)
    })

    it('equals total loan debt after loan is taken', async () => {
      await creditOracle.setScore(borrower.address, 200)
      await ftlAgency.setLongTermLoanThreshold(DAY)
      await borrow(borrower, pool1, parseEth(100000), YEAR)
      expect(await ftlAgency.totalBorrowed(borrower.address, 18)).to.equal(parseEth(110760))
    })

    it('repaying does not affect totalBorrowed value', async () => {
      await creditOracle.setScore(borrower.address, 200)
      await ftlAgency.setLongTermLoanThreshold(DAY)
      await borrow(borrower, pool1, parseEth(100000), YEAR)
      const loan = await borrowingMutex.locker(borrower.address)
      expect(await ftlAgency.totalBorrowed(borrower.address, 18)).to.equal(parseEth(110760))
      await token1.mint(loan, parseEth(1000))
      expect(await ftlAgency.totalBorrowed(borrower.address, 18)).to.equal(parseEth(110760))
    })

    it('normalizes to decimal places', async () => {
      await creditOracle.setScore(borrower.address, 200)
      await ftlAgency.setLongTermLoanThreshold(DAY)
      await borrow(borrower, pool1, parseEth(100000), YEAR)
      expect(await ftlAgency.totalBorrowed(borrower.address, 8)).to.equal(parseTRU(110760))
    })
  })

  describe('value', () => {
    beforeEach(async () => {
      const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
      await ftlAgency.setBorrowingMutex(mockMutex.address)
      await mockMutex.mock.isUnlocked.returns(true)
      await mockMutex.mock.lock.returns()
      await mockMutex.mock.locker.returns(AddressZero)

      await ftlAgency.connect(borrower).borrow(pool1.address, 100000, YEAR, 1000)
      await ftlAgency.connect(borrower).borrow(pool1.address, 100000, DAY, 1000)
      await ftlAgency.connect(borrower).borrow(pool2.address, 500000, YEAR, 1000)
    })

    it('shows correct value for a newly added loan', async () => {
      expect(await ftlAgency.value(pool1.address)).to.equal(200000)
      expect(await ftlAgency.value(pool2.address)).to.equal(500000)
    })

    it('value should increase with time', async () => {
      await timeTravel(DAY / 2)
      expect(await ftlAgency.value(pool1.address)).to.equal(200016)
      expect(await ftlAgency.value(pool2.address)).to.equal(500054)
    })

    it('value stops increasing after term passes', async () => {
      await timeTravel(YEAR)
      expect(await ftlAgency.value(pool1.address)).to.equal(208013)
      expect(await ftlAgency.value(pool2.address)).to.equal(540000)
      await timeTravel(YEAR * 10)
      expect(await ftlAgency.value(pool1.address)).to.equal(208013)
      expect(await ftlAgency.value(pool2.address)).to.equal(540000)
    })
  })

  describe('rate', () => {
    it('returns correct rate', async () => {
      const baseRate = await rateModel.rate(pool1.address, 255, parseEth(1e5))
      const ftlAdjustment = await rateModel.fixedTermLoanAdjustment(YEAR)
      expect(await ftlAgency.rate(pool1.address, borrower.address, parseEth(1e5), YEAR))
        .to.eq(baseRate.add(ftlAdjustment))
    })

    it('reduces rate after staking TRU', async () => {
      await creditOracle.setScore(borrower.address, 200)
      const noStakingRate = await ftlAgency.rate(pool1.address, borrower.address, parseEth(1e5), YEAR)
      await tru.mint(borrower.address, parseTRU(1e7))
      await tru.connect(borrower).approve(stakingVault.address, parseTRU(1e7))
      await stakingVault.connect(borrower).stake(parseTRU(1e7))
      expect(await ftlAgency.rate(pool1.address, borrower.address, parseEth(1e5), YEAR))
        .to.be.lt(noStakingRate)
    })
  })

  describe('Reclaiming', () => {
    const payBack = async (token: MockErc20Token, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
    }

    let loan: LoanToken2

    beforeEach(async () => {
      loan = await extractLoanTokenAddress(ftlAgency.connect(borrower).borrow(pool1.address, 100000, YEAR, 1000))
      await ftlAgency.setFee(0)
    })

    it('works only for closed loans', async () => {
      await expect(ftlAgency.reclaim(loan.address, '0x'))
        .to.be.revertedWith('FixedTermLoanAgency: LoanToken is not closed yet')
    })

    it('reverts if loan has not been previously funded', async () => {
      const mockLoanToken = await deployMockContract(owner, LoanToken2Json.abi)
      await mockLoanToken.mock.status.returns(3)
      await mockLoanToken.mock.pool.returns(pool1.address)
      await expect(ftlAgency.reclaim(mockLoanToken.address, '0x'))
        .to.be.revertedWith('FixedTermLoanAgency: This loan has not been funded by the agency')
    })

    it('redeems funds from loan token', async () => {
      await payBack(token1, loan)
      await loan.settle()
      await expect(ftlAgency.reclaim(loan.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(loan.address, ftlAgency.address, 108000)
    })

    it('repays funds from the pool', async () => {
      await payBack(token1, loan)
      await loan.settle()
      await expect(ftlAgency.reclaim(loan.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(ftlAgency.address, pool1.address, 108000)
    })

    it('defaulted loans can only be reclaimed by owner', async () => {
      await timeTravel(YEAR * 2)
      await loan.enterDefault()
      await expect(ftlAgency.connect(borrower).reclaim(loan.address, '0x'))
        .to.be.revertedWith('FixedTermLoanAgency: Only owner can reclaim from defaulted loan')
    })

    it('emits a proper event', async () => {
      await payBack(token1, loan)
      await loan.settle()
      await expect(ftlAgency.reclaim(loan.address, '0x'))
        .to.emit(ftlAgency, 'Reclaimed')
        .withArgs(pool1.address, loan.address, 108000)
    })

    describe('Removes loan from array', () => {
      let newLoan1: LoanToken2
      let newLoan2: LoanToken2

      beforeEach(async () => {
        const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
        await ftlAgency.setBorrowingMutex(mockMutex.address)
        await loanFactory.setBorrowingMutex(mockMutex.address)
        await mockMutex.mock.isUnlocked.returns(true)
        await mockMutex.mock.lock.returns()
        await mockMutex.mock.unlock.returns()
        await mockMutex.mock.locker.returns(AddressZero)

        await payBack(token1, loan)
        await loan.settle()

        newLoan1 = await extractLoanTokenAddress(ftlAgency.connect(borrower).borrow(pool1.address, 100000, DAY, 1000))
        newLoan2 = await extractLoanTokenAddress(ftlAgency.connect(borrower).borrow(pool2.address, 500000, YEAR, 1000))
      })

      it('removes oldest loan from the array', async () => {
        expect(await ftlAgency.loans(pool1.address)).to.deep.equal([loan.address, newLoan1.address])
        await ftlAgency.reclaim(loan.address, '0x')
        expect(await ftlAgency.loans(pool1.address)).to.deep.equal([newLoan1.address])
      })

      it('removes newest loan from the array', async () => {
        await payBack(token1, newLoan1)
        await newLoan1.settle()

        expect(await ftlAgency.loans(pool1.address)).to.deep.equal([loan.address, newLoan1.address])
        await ftlAgency.reclaim(newLoan1.address, '0x')
        expect(await ftlAgency.loans(pool1.address)).to.deep.equal([loan.address])
      })

      it('preserves loans for other pools', async () => {
        await ftlAgency.reclaim(loan.address, '0x')
        expect(await ftlAgency.loans(pool2.address)).to.deep.equal([newLoan2.address])
      })
    })

    describe('With fees', () => {
      let fee: BigNumber
      let newLoan1: LoanToken2
      beforeEach(async () => {
        const mockMutex = await deployMockContract(owner, BorrowingMutexJson.abi)
        await ftlAgency.setBorrowingMutex(mockMutex.address)
        await loanFactory.setBorrowingMutex(mockMutex.address)
        await mockMutex.mock.isUnlocked.returns(true)
        await mockMutex.mock.lock.returns()
        await mockMutex.mock.unlock.returns()
        await mockMutex.mock.locker.returns(AddressZero)

        newLoan1 = await extractLoanTokenAddress(ftlAgency.connect(borrower).borrow(pool1.address, parseEth(100000), YEAR, 1000))

        await ftlAgency.setFee(1000)
        await oneInch.setOutputAmount(parseEth(25))
        await payBack(token1, newLoan1)
        await newLoan1.settle()
        fee = (await newLoan1.debt()).sub(await newLoan1.amount()).div(10)
      })

      const encodeData = (fromToken: string, toToken: string, sender: string, receiver: string, amount: BigNumberish, flags = 0) => {
        const iface = new utils.Interface(Mock1InchV3Json.abi)
        return iface.encodeFunctionData('swap', [AddressZero, {
          srcToken: fromToken,
          dstToken: toToken,
          srcReceiver: sender,
          dstReceiver: receiver,
          amount: amount,
          minReturnAmount: 0,
          flags: flags,
          permit: '0x',
        }, '0x'])
      }

      it('swaps token for usdc', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee)
        await ftlAgency.reclaim(newLoan1.address, data)
      })

      it('fee is not sent to the pool', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee)
        await expect(ftlAgency.reclaim(newLoan1.address, data))
          .to.emit(token1, 'Transfer')
          .withArgs(ftlAgency.address, pool1.address, parseEth(108010).sub(fee))
      })

      it('reverts on wrong destination token', async () => {
        await token2.mint(ftlAgency.address, fee)
        const data = encodeData(token2.address, usdc.address, ftlAgency.address, ftlAgency.address, fee)
        await expect(ftlAgency.reclaim(newLoan1.address, data)).to.be.revertedWith('FixedTermLoanAgency: Source token is not same as pool\'s token')
      })

      it('reverts when receiver is not ftlAgency', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, pool1.address, fee)
        await expect(ftlAgency.reclaim(newLoan1.address, data)).to.be.revertedWith('FixedTermLoanAgency: Receiver is not agency')
      })

      it('reverts on wrong amount', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee.sub(1))
        await expect(ftlAgency.reclaim(newLoan1.address, data)).to.be.revertedWith('FixedTermLoanAgency: Incorrect fee swap amount')
      })

      it('reverts if partial fill is allowed', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee, 1)
        await expect(ftlAgency.reclaim(newLoan1.address, data)).to.be.revertedWith('FixedTermLoanAgency: Partial fill is not allowed')
      })

      it('reverts if small USDC amount is returned', async () => {
        await oneInch.setOutputAmount(parseUSDC(24))
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee)
        await expect(ftlAgency.reclaim(newLoan1.address, data)).to.be.revertedWith('FixedTermLoanAgency: Fee returned from swap is too small')
      })

      it('puts fee into USDC pool and transfers LP tokens to stakers', async () => {
        const data = encodeData(token1.address, usdc.address, ftlAgency.address, ftlAgency.address, fee)
        await expect(ftlAgency.reclaim(newLoan1.address, data))
          .to.emit(feePool, 'Joined')
          .withArgs(ftlAgency.address, parseEth(25), parseEth(25))
          .and.to.emit(feePool, 'Transfer')
          .withArgs(ftlAgency.address, stkTru.address, parseEth(25))
      })
    })
  })
})
