import { expect, use } from 'chai'
import { BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, parseEth, setupTruefi2, createDebtToken as _createDebtToken } from 'utils'

import {
  BorrowingMutex,
  BorrowingMutex__factory,
  FixedTermLoanAgency,
  FixedTermLoanAgency__factory,
  LoanFactory2,
  TrueFiPool2,
  Liquidator2,
  PoolFactory,
  LoanFactory2__factory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  CreditModel,
  CreditModel__factory,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  TestLoanToken__factory,
  LineOfCreditAgency,
  DebtToken,
  DebtToken__factory,
} from 'contracts'
import { solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('LoanFactory2', () => {
  let owner: Wallet
  let borrower: Wallet
  let depositor: Wallet
  let ftla: Wallet
  let fakeCreditAgency: Wallet
  let liquidator: Liquidator2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let poolToken: MockTrueCurrency
  let loanFactory: LoanFactory2
  let creditModel: CreditModel
  let creditOracle: TrueFiCreditOracle
  let borrowingMutex: BorrowingMutex
  let creditAgency: LineOfCreditAgency

  const createLoanToken = async (pool: TrueFiPool2, borrower: Wallet, amount: BigNumberish, term: BigNumberish, apy: BigNumberish) => {
    await loanFactory.setFixedTermLoanAgency(ftla.address)
    const tx = await loanFactory.connect(ftla).createLoanToken(pool.address, borrower.address, amount, term, apy)
    const creationEvent = (await tx.wait()).events[0]
    const { loanToken } = creationEvent.args
    return LoanToken2__factory.connect(loanToken, owner)
  }

  const createDebtToken = async (pool: TrueFiPool2, borrower: Wallet, debt: BigNumberish) => {
    return _createDebtToken(loanFactory, fakeCreditAgency, owner, pool, borrower, debt)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, depositor, ftla, fakeCreditAgency] = wallets

    ; ({
      standardPool: pool,
      standardToken: poolToken,
      loanFactory,
      liquidator,
      poolFactory,
      creditModel,
      creditOracle,
      borrowingMutex,
      creditAgency,
    } = await setupTruefi2(owner, _provider))
    await loanFactory.setCreditModel(creditModel.address)
    await creditOracle.setScore(borrower.address, 255)

    await poolToken.mint(depositor.address, parseEth(10_000))
    await poolToken.connect(depositor).approve(pool.address, parseEth(10_000))
    await pool.connect(depositor).join(parseEth(10_000))
  })

  describe('initializer', () => {
    it('sets poolFactory', async () => {
      expect(await loanFactory.poolFactory()).to.eq(poolFactory.address)
    })

    it('sets liquidator', async () => {
      expect(await loanFactory.liquidator()).to.eq(liquidator.address)
    })

    it('sets creditModel', async () => {
      expect(await loanFactory.creditModel()).to.eq(creditModel.address)
    })

    it('sets creditOracle', async () => {
      expect(await loanFactory.creditOracle()).to.eq(creditOracle.address)
    })

    it('sets borrowingMutex', async () => {
      expect(await loanFactory.borrowingMutex()).to.eq(borrowingMutex.address)
    })

    it('sets creditAgency', async () => {
      expect(await loanFactory.creditAgency()).to.eq(creditAgency.address)
    })
  })

  describe('createLoanToken', () => {
    let loanToken: LoanToken2

    beforeEach(async () => {
      loanToken = await createLoanToken(pool, borrower, parseEth(1), 15 * DAY, 1000)
    })

    describe('reverts if', () => {
      it('caller is not FTLA', async () => {
        await expect(loanFactory.connect(borrower).createLoanToken(pool.address, borrower.address, parseEth(1), 15 * DAY, 1000))
          .to.be.revertedWith('LoanFactory: Caller is not the fixed term loan agency')
      })

      it('there is no token implementation', async () => {
        const factory = await new LoanFactory2__factory(owner).deploy()
        await factory.initialize(
          AddressZero, ftla.address, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero,
        )
        await expect(factory.connect(ftla).createLoanToken(pool.address, borrower.address, parseEth(1), 15 * DAY, 1000))
          .to.be.revertedWith('LoanFactory: Loan token implementation should be set')
      })

      it('loan token initialize signature differs from expected', async () => {
        const debtToken = await new DebtToken__factory(owner).deploy()
        await loanFactory.connect(owner).setLoanTokenImplementation(debtToken.address)
        await expect(loanFactory.connect(ftla).createLoanToken(pool.address, borrower.address, parseEth(1), 15 * DAY, 1000))
          .to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function')
      })
    })

    describe('deploys loan token contract', () => {
      it('has storage variables set properly', async () => {
        enum Status { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

        expect(await loanToken.pool()).to.eq(pool.address)
        expect(await loanToken.borrowingMutex()).to.eq(borrowingMutex.address)
        expect(await loanToken.borrower()).to.eq(borrower.address)
        expect(await loanToken.ftlAgency()).to.eq(ftla.address)
        expect(await loanToken.admin()).to.eq(owner.address)
        expect(await loanToken.loanFactory()).to.eq(loanFactory.address)
        expect(await loanToken.amount()).to.eq(parseEth(1))
        expect(await loanToken.term()).to.eq(15 * DAY)
        expect(await loanToken.apy()).to.eq(1000)
        expect(await loanToken.status()).to.eq(Status.Awaiting)
      })

      it('marks deployed contract as loan token', async () => {
        expect(await loanFactory.isLoanToken(loanToken.address)).to.be.true
      })
    })
  })

  describe('createDebtToken', () => {
    let debtToken

    beforeEach(async () => {
      debtToken = await createDebtToken(pool, borrower, parseEth(1))
    })

    describe('reverts if', () => {
      it('caller is not CreditAgency or loan', async () => {
        await expect(loanFactory.connect(borrower).createDebtToken(pool.address, borrower.address, parseEth(1)))
          .to.be.revertedWith('LoanFactory: Caller is neither credit agency nor loan')
      })

      it('there is no token implementation', async () => {
        const factory = await new LoanFactory2__factory(owner).deploy()
        await factory.initialize(
          AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, fakeCreditAgency.address,
        )
        await expect(factory.connect(fakeCreditAgency).createDebtToken(pool.address, borrower.address, parseEth(1)))
          .to.be.revertedWith('LoanFactory: Debt token implementation should be set')
      })

      it('debt token initialize signature differs from expected', async () => {
        const testLoanToken = await new TestLoanToken__factory(owner).deploy()
        await loanFactory.connect(owner).setDebtTokenImplementation(testLoanToken.address)
        await expect(loanFactory.connect(fakeCreditAgency).createDebtToken(pool.address, borrower.address, parseEth(1)))
          .to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function')
      })
    })

    describe('deploys debt token contract', () => {
      it('has storage variables set properly', async () => {
        enum Status { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

        expect(await debtToken.pool()).to.eq(pool.address)
        expect(await debtToken.borrower()).to.eq(borrower.address)
        expect(await debtToken.liquidator()).to.eq(liquidator.address)
        expect(await debtToken.debt()).to.eq(parseEth(1))
        expect(await debtToken.status()).to.eq(Status.Defaulted)
        expect(await debtToken.balanceOf(fakeCreditAgency.address)).to.eq(parseEth(1))
      })

      it('marks deployed contract as debt token', async () => {
        expect(await loanFactory.isDebtToken(debtToken.address)).to.be.true
      })
    })
  })

  describe('isCreatedByFactory', () => {
    describe('returns true for', () => {
      it('loan token created by factory', async () => {
        const loanToken = await createLoanToken(pool, borrower, parseEth(1), DAY, 1000)
        expect(await loanFactory.isCreatedByFactory(loanToken.address)).to.eq(true)
      })

      it('debt token created by factory', async () => {
        const debtToken = await createDebtToken(pool, borrower, parseEth(1))
        expect(await loanFactory.isCreatedByFactory(debtToken.address)).to.eq(true)
      })
    })

    describe('returns false for', () => {
      it('loan token not created by factory', async () => {
        const loanToken = await new LoanToken2__factory(owner).deploy()
        expect(await loanFactory.isCreatedByFactory(loanToken.address)).to.eq(false)
      })

      it('debt token not created by factory', async () => {
        const debtToken = await new DebtToken__factory(owner).deploy()
        expect(await loanFactory.isCreatedByFactory(debtToken.address)).to.eq(false)
      })

      it('non-loan address', async () => {
        expect(await loanFactory.isCreatedByFactory(owner.address)).to.eq(false)
      })
    })
  })

  describe('setCreditOracle', () => {
    let fakeCreditOracle: TrueFiCreditOracle
    beforeEach(async () => {
      fakeCreditOracle = await new TrueFiCreditOracle__factory(owner).deploy()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setCreditOracle(fakeCreditOracle.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setCreditOracle(fakeCreditOracle.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setCreditOracle(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set credit oracle to zero address')
    })

    it('changes creditOracle', async () => {
      await loanFactory.setCreditOracle(fakeCreditOracle.address)
      expect(await loanFactory.creditOracle()).to.eq(fakeCreditOracle.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setCreditOracle(fakeCreditOracle.address))
        .to.emit(loanFactory, 'CreditOracleChanged')
        .withArgs(fakeCreditOracle.address)
    })
  })

  describe('setCreditModel', () => {
    let fakeCreditModel: CreditModel
    beforeEach(async () => {
      fakeCreditModel = await new CreditModel__factory(owner).deploy()
      await fakeCreditModel.initialize(AddressZero)
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setCreditModel(fakeCreditModel.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setCreditModel(fakeCreditModel.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setCreditModel(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set credit model to zero address')
    })

    it('changes creditModel', async () => {
      await loanFactory.setCreditModel(fakeCreditModel.address)
      expect(await loanFactory.creditModel()).to.eq(fakeCreditModel.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setCreditModel(fakeCreditModel.address))
        .to.emit(loanFactory, 'CreditModelChanged')
        .withArgs(fakeCreditModel.address)
    })
  })

  describe('setBorrowingMutex', () => {
    let fakeBorrowingMutex: BorrowingMutex
    beforeEach(async () => {
      fakeBorrowingMutex = await new BorrowingMutex__factory(owner).deploy()
      await fakeBorrowingMutex.initialize()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setBorrowingMutex(fakeBorrowingMutex.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setBorrowingMutex(fakeBorrowingMutex.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setBorrowingMutex(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set borrowing mutex to zero address')
    })

    it('changes borrowingMutex', async () => {
      await loanFactory.setBorrowingMutex(fakeBorrowingMutex.address)
      expect(await loanFactory.borrowingMutex()).to.eq(fakeBorrowingMutex.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setBorrowingMutex(fakeBorrowingMutex.address))
        .to.emit(loanFactory, 'BorrowingMutexChanged')
        .withArgs(fakeBorrowingMutex.address)
    })
  })

  describe('setLoanTokenImplementation', () => {
    let implementation: LoanToken2
    beforeEach(async () => {
      implementation = await new LoanToken2__factory(owner).deploy()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setLoanTokenImplementation(implementation.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setLoanTokenImplementation(implementation.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setLoanTokenImplementation(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set loan token implementation to zero address')
    })

    it('changes loanTokenImplementation', async () => {
      await loanFactory.setLoanTokenImplementation(implementation.address)
      expect(await loanFactory.loanTokenImplementation()).to.eq(implementation.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setLoanTokenImplementation(implementation.address))
        .to.emit(loanFactory, 'LoanTokenImplementationChanged')
        .withArgs(implementation.address)
    })
  })

  describe('setCreditAgency', () => {
    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setCreditAgency(creditAgency.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setCreditAgency(creditAgency.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setCreditAgency(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set credit agency to zero address')
    })

    it('changes creditAgency', async () => {
      await loanFactory.setCreditAgency(creditAgency.address)
      expect(await loanFactory.creditAgency()).to.eq(creditAgency.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setCreditAgency(creditAgency.address))
        .to.emit(loanFactory, 'CreditAgencyChanged')
        .withArgs(creditAgency.address)
    })
  })

  describe('setDebtTokenImplementation', () => {
    let implementation: DebtToken
    beforeEach(async () => {
      implementation = await new DebtToken__factory(owner).deploy()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setDebtTokenImplementation(implementation.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setDebtTokenImplementation(implementation.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setDebtTokenImplementation(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set debt token implementation to zero address')
    })

    it('changes debtTokenImplementation', async () => {
      await loanFactory.setDebtTokenImplementation(implementation.address)
      expect(await loanFactory.debtTokenImplementation()).to.eq(implementation.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setDebtTokenImplementation(implementation.address))
        .to.emit(loanFactory, 'DebtTokenImplementationChanged')
        .withArgs(implementation.address)
    })
  })

  describe('setFixedTermLoanAgency', () => {
    let ftlAgency: FixedTermLoanAgency
    beforeEach(async () => {
      ftlAgency = await new FixedTermLoanAgency__factory(owner).deploy()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setFixedTermLoanAgency(ftlAgency.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setFixedTermLoanAgency(ftlAgency.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to zero address', async () => {
      await expect(loanFactory.setFixedTermLoanAgency(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set fixed term loan agency to zero address')
    })

    it('changes fixed term loan agency', async () => {
      await loanFactory.setFixedTermLoanAgency(ftlAgency.address)
      expect(await loanFactory.ftlAgency()).to.eq(ftlAgency.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setFixedTermLoanAgency(ftlAgency.address))
        .to.emit(loanFactory, 'FixedTermLoanAgencyChanged')
        .withArgs(ftlAgency.address)
    })
  })
})
