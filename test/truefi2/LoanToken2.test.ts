import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, expectScaledCloseTo, extractDebtTokens, parseEth, timeTravel } from 'utils'

import {
  BorrowingMutex,
  BorrowingMutex__factory,
  DebtToken__factory,
  FixedTermLoanAgency__factory,
  ImplementationReference__factory,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  MockTrueCurrency__factory,
  PoolFactory__factory,
  TestLoanFactory,
  TestLoanFactory__factory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueFiPool2__factory,
} from 'contracts'
import { deployContract } from 'scripts/utils/deployContract'
import { AddressZero } from '@ethersproject/constants'
import { formatEther } from '@ethersproject/units'

use(solidity)

describe('LoanToken2', () => {
  enum LoanTokenStatus { Withdrawn, Settled, Defaulted }

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12
  const defaultedLoanCloseTime = yearInSeconds + 3 * dayInSeconds

  const payback = async (wallet: Wallet, amount: BigNumberish) => token.mint(loanToken.address, amount)

  let lender: Wallet
  let borrower: Wallet
  let loanToken: LoanToken2
  let token: MockTrueCurrency
  let poolAddress: string
  let provider: MockProvider
  let borrowingMutex: BorrowingMutex
  let creditOracle: TrueFiCreditOracle
  let loanFactory: TestLoanFactory
  let creationTimestamp: BigNumberish

  beforeEachWithFixture(async (wallets, _provider) => {
    [lender, borrower] = wallets
    provider = _provider

    token = await new MockTrueCurrency__factory(lender).deploy()
    await token.initialize()
    await token.mint(lender.address, parseEth(1000))

    const poolFactory = await deployContract(lender, PoolFactory__factory)
    loanFactory = await deployContract(lender, TestLoanFactory__factory)
    const poolImplementation = await deployContract(lender, TrueFiPool2__factory)
    const implementationReference = await deployContract(lender, ImplementationReference__factory, [poolImplementation.address])
    creditOracle = await deployContract(lender, TrueFiCreditOracle__factory)
    const ftlAgency = await deployContract(lender, FixedTermLoanAgency__factory)
    await ftlAgency.initialize(AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, loanFactory.address, AddressZero)
    await poolFactory.initialize(implementationReference.address, AddressZero, ftlAgency.address, AddressZero, loanFactory.address)
    await poolFactory.allowToken(token.address, true)
    await poolFactory.createPool(token.address)
    await creditOracle.initialize()
    poolAddress = await poolFactory.pool(token.address)
    borrowingMutex = await deployContract(lender, BorrowingMutex__factory)
    await borrowingMutex.initialize()
    await borrowingMutex.allowLocker(lender.address, true)
    await loanFactory.initialize(AddressZero, AddressZero, AddressZero, borrowingMutex.address, AddressZero)
    const debtToken = await deployContract(lender, DebtToken__factory)
    await loanFactory.setDebtTokenImplementation(debtToken.address)
    loanToken = await new LoanToken2__factory(lender).deploy()
    const tx = await loanToken.initialize(
      poolAddress,
      borrowingMutex.address,
      borrower.address,
      lender.address,
      lender.address,
      loanFactory.address,
      creditOracle.address,
      parseEth(1000),
      yearInSeconds,
      1000,
    )
    const { blockNumber } = await tx.wait()
    creationTimestamp = (await provider.getBlock(blockNumber)).timestamp
    await borrowingMutex.lock(borrower.address, loanToken.address)
    await loanFactory.setIsLoanToken(loanToken.address)
    await token.transfer(borrower.address, parseEth(1000))
  })

  describe('Constructor', () => {
    it('correctly takes token from pool', async () => {
      expect(await loanToken.token()).to.equal(token.address)
    })

    it('sets pool address', async () => {
      expect(await loanToken.pool()).to.equal(poolAddress)
    })

    it('sets loan params', async () => {
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Withdrawn)
      expect(await loanToken.borrower()).to.equal(borrower.address)
      expect(await loanToken.principal()).to.equal(parseEth(1000))
      expect(await loanToken.interest()).to.equal(parseEth(100))
      expect(await loanToken.tokenRedeemed()).to.equal(0)
      expect(await loanToken.start()).to.be.equal(creationTimestamp)
      expect(await loanToken.term()).to.equal(yearInSeconds)
      expect(await loanToken.borrowingMutex()).to.equal(borrowingMutex.address)
      expect(await loanToken.creditOracle()).to.equal(creditOracle.address)
      expect(await loanToken.loanFactory()).to.equal(loanFactory.address)
      expect(await loanToken.debtToken()).to.equal(AddressZero)
    })

    it('sets borrowers debt', async () => {
      expect(await loanToken.debt()).to.equal(parseEth(1100))
    })

    it('mints tokens to ftlAgency', async () => {
      expect(await loanToken.balanceOf(lender.address)).to.equal(parseEth(1100))
    })

    it('sets erc20 params', async () => {
      expect(await loanToken.name()).to.equal('TrueFi Loan Token')
      expect(await loanToken.symbol()).to.equal('LOAN')
      expect(await loanToken.decimals()).to.equal(18)
    })
  })

  describe('Settle', () => {
    it('sets status to Settled if whole debt has been returned after term has passed', async () => {
      await timeTravel(provider, yearInSeconds)
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('sets status to Settled if whole debt has been returned before term has passed', async () => {
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('loan can be payed back 1 day after term has ended', async () => {
      await timeTravel(provider, yearInSeconds + dayInSeconds / 2)
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan has not reached end of term')
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('unlocks the mutex', async () => {
      await token.mint(loanToken.address, parseEth(1100))
      expect(await borrowingMutex.isUnlocked(borrower.address)).to.be.false
      await loanToken.settle()
      expect(await borrowingMutex.isUnlocked(borrower.address)).to.be.true
    })
  })

  describe('Enter Default', () => {
    it('sets status to Defaulted if no debt has been returned', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Defaulted if not whole debt has been returned', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await token.mint(loanToken.address, parseEth(1099))
      await loanToken.enterDefault()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('reverts when closing right after creation', async () => {
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan has not reached end of term')
    })

    it('reverts when closing ongoing loan', async () => {
      await timeTravel(provider, yearInSeconds - 10)
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan has not reached end of term')
    })

    it('reverts when trying to close already closed loan', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Status is not Withdrawn')
    })

    it('emits event', async () => {
      await token.mint(loanToken.address, parseEth(1099))
      await timeTravel(provider, defaultedLoanCloseTime)
      const tx = loanToken.enterDefault()
      const [debtToken] = await extractDebtTokens(loanFactory, lender, tx)
      await expect(tx).to.emit(loanToken, 'Defaulted').withArgs(debtToken.address, parseEth(1))
    })

    it('bans the borrower', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      expect(await borrowingMutex.isUnlocked(borrower.address)).to.be.false
      await loanToken.enterDefault()
      expect(await borrowingMutex.isUnlocked(borrower.address)).to.be.false
      expect(await borrowingMutex.locker(borrower.address)).to.equal('0x0000000000000000000000000000000000000001')
    })

    it('mints new DebtTokens and transfers them to the pool', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      const debtToken = DebtToken__factory.connect(await loanToken.debtToken(), lender)
      expect(await debtToken.balanceOf(poolAddress)).to.equal(parseEth(1100))
    })

    it('after partial repayment, mints debtTokens for rest which is not repaid', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await token.mint(loanToken.address, parseEth(550))
      await loanToken.enterDefault()
      const debtToken = DebtToken__factory.connect(await loanToken.debtToken(), lender)
      expect(await debtToken.balanceOf(poolAddress)).to.equal(parseEth(550))
      expect(await loanToken.currentValue(lender.address)).to.equal(parseEth(550))
    })
  })

  describe('Repay', () => {
    it('transfers trueCurrencies to loanToken', async () => {
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await loanToken.repay(borrower.address, parseEth(100))

      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(1000).sub(parseEth(100)))
      expect(await token.balanceOf(loanToken.address)).to.equal(parseEth(100))
    })

    it('reverts if borrower tries to repay more than remaining debt', async () => {
      await token.mint(borrower.address, parseEth(300))
      await token.connect(borrower).approve(loanToken.address, parseEth(1200))

      await expect(loanToken.repay(borrower.address, parseEth(1200)))
        .to.be.revertedWith('LoanToken2: Repay amount more than unpaid debt')

      await loanToken.repay(borrower.address, parseEth(500))

      await expect(loanToken.repay(borrower.address, parseEth(1000)))
        .to.be.revertedWith('LoanToken2: Repay amount more than unpaid debt')
    })

    it('emits proper event', async () => {
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await expect(loanToken.repay(borrower.address, parseEth(100)))
        .to.emit(loanToken, 'Repaid')
        .withArgs(borrower.address, parseEth(100))
    })
  })

  describe('Repay in full', () => {
    it('transfers trueCurrencies to loanToken', async () => {
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await loanToken.repayInFull(borrower.address)

      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(1000).add(parseEth(300)).sub(debt))
      expect(await token.balanceOf(loanToken.address)).to.equal(debt)
    })

    it('emits Repaid event', async () => {
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await expect(loanToken.repayInFull(borrower.address))
        .to.emit(loanToken, 'Repaid')
        .withArgs(borrower.address, debt)
    })

    it('emits Settled event', async () => {
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await expect(loanToken.repayInFull(borrower.address))
        .to.emit(loanToken, 'Settled')
        .withArgs(debt)
    })
  })

  describe('Redeem', () => {
    beforeEach(async () => {
      await token.mint(borrower.address, parseEth(100))
    })

    it('reverts if called before loan is closed', async () => {
      await expect(loanToken.redeem()).to.be.revertedWith('LoanToken2: Only after loan has been closed')
    })

    it('emits event', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await payback(borrower, parseEth(1000))
      await loanToken.enterDefault()
      await expect(loanToken.redeem()).to.emit(loanToken, 'Redeemed').withArgs(lender.address, parseEth(1100), parseEth(1000))
    })

    describe('Simple case: loan settled, redeem all', () => {
      beforeEach(async () => {
        await timeTravel(provider, yearInSeconds)
        await payback(borrower, await parseEth(1100))
        await loanToken.settle()
        await expect(() => loanToken.redeem()).to.changeTokenBalance(token, lender, parseEth(1100))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('decreases unpaidDebt down to 0', async () => {
        expect(await loanToken.unpaidDebt()).to.equal(0)
      })
    })

    describe('loan defaulted (3/4 paid back), redeem all', () => {
      beforeEach(async () => {
        await timeTravel(provider, defaultedLoanCloseTime)
        await payback(borrower, parseEth(825))
        await loanToken.enterDefault()
        await expect(() => loanToken.redeem()).to.changeTokenBalance(token, lender, parseEth(825))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('decreases unpaidDebt', async () => {
        expect(await loanToken.unpaidDebt()).to.equal(parseEth(275))
      })
    })
  })

  describe('Debt calculation', () => {
    const getDebt = async (amount: number, termInMonths: number, apy: number) => {
      const contract = await new LoanToken2__factory(borrower).deploy()
      await contract.initialize(poolAddress, borrowingMutex.address, borrower.address, lender.address, lender.address, lender.address, AddressZero, parseEth(amount.toString()), termInMonths * averageMonthInSeconds, apy)
      return Number.parseInt(formatEther(await contract.debt()))
    }

    it('1 year, 10%', async () => {
      expect(await getDebt(1000, 12, 1000)).to.equal(1100)
    })

    it('1 year, 25%', async () => {
      expect(await getDebt(1000, 12, 2500)).to.equal(1250)
    })

    it('0.5 year, 10%', async () => {
      expect(await getDebt(1000, 6, 1000)).to.equal(1050)
    })

    it('3 years, 8%', async () => {
      expect(await getDebt(1000, 36, 800)).to.equal(1240)
    })

    it('2.5 years, 12%', async () => {
      expect(await getDebt(1000, 30, 1200)).to.equal(1300)
    })
  })

  describe('unpaidDebt', () => {
    it('decreases after repayment', async () => {
      expect(await loanToken.unpaidDebt()).to.eq(parseEth(1100))
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await loanToken.repay(borrower.address, parseEth(100))
      expect(await loanToken.unpaidDebt()).to.eq(parseEth(1000))
    })

    it('doesn\'t change after redeem', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      await payback(borrower, parseEth(100))
      expect(await loanToken.unpaidDebt()).to.eq(parseEth(1000))
      await loanToken.redeem()
      expect(await loanToken.unpaidDebt()).to.eq(parseEth(1000))
    })

    it('is 0 when repaid whole debt or more', async () => {
      await payback(borrower, parseEth(1100))
      expect(await loanToken.unpaidDebt()).to.eq(0)
      await payback(borrower, parseEth(100))
      expect(await loanToken.unpaidDebt()).to.eq(0)
      await loanToken.settle()
      await loanToken.redeem()
      expect(await loanToken.unpaidDebt()).to.eq(0)
    })
  })

  describe('Value', () => {
    it('beginning of the loan', async () => {
      expectScaledCloseTo(await loanToken.currentValue(lender.address), parseEth(1000))
    })

    it('middle of the loan', async () => {
      await timeTravel(provider, averageMonthInSeconds * 6)
      expectScaledCloseTo(await loanToken.currentValue(lender.address), parseEth(1050))
      await timeTravel(provider, averageMonthInSeconds * 3)
      expectScaledCloseTo(await loanToken.currentValue(lender.address), parseEth(1075))
    })

    it('end of the loan', async () => {
      await timeTravel(provider, yearInSeconds)
      expectScaledCloseTo(await loanToken.currentValue(lender.address), parseEth(1100))
    })

    it('loan fully repaid and closed before term', async () => {
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.currentValue(lender.address)).to.eq(parseEth(1100))
    })

    it('loan partially repaid, defaulted', async () => {
      await timeTravel(provider, defaultedLoanCloseTime)
      await token.mint(loanToken.address, parseEth(123))
      expect(await loanToken.currentValue(lender.address)).to.eq(parseEth(1100))
      await loanToken.enterDefault()
      expect(await loanToken.currentValue(lender.address)).to.eq(parseEth(123))
    })
  })
})
