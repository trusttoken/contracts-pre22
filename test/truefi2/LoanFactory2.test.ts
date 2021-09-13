import { expect, use } from 'chai'
import { BigNumber, BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, MAX_APY, parseEth, setupTruefi2, createDebtToken as _createDebtToken } from 'utils'

import {
  BorrowingMutex,
  BorrowingMutex__factory,
  LoanFactory2,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2,
  Liquidator2,
  PoolFactory,
  LoanFactory2__factory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  TestLoanToken__factory,
  TrueCreditAgency,
  DebtToken,
  DebtToken__factory,
} from 'contracts'
import { PoolFactoryJson } from 'build'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('LoanFactory2', () => {
  let owner: Wallet
  let borrower: Wallet
  let depositor: Wallet
  let tca: Wallet
  let lender: TrueLender2
  let liquidator: Liquidator2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let poolToken: MockTrueCurrency
  let contractAddress: string
  let loanFactory: LoanFactory2
  let loanToken: LoanToken2
  let rateAdjuster: TrueRateAdjuster
  let creditOracle: TrueFiCreditOracle
  let borrowerCreditScore: number
  let borrowingMutex: BorrowingMutex
  let creditAgency: TrueCreditAgency

  const createLoan = async (amount: BigNumberish, term: BigNumberish) => {
    const tx = await loanFactory.connect(borrower).createLoanToken(pool.address, amount, term, MAX_APY)
    const creationEvent = (await tx.wait()).events[0]
      ; ({ contractAddress } = creationEvent.args)
    return LoanToken2__factory.connect(contractAddress, owner)
  }

  const createDebtToken = async (pool: TrueFiPool2, borrower: Wallet, debt: BigNumberish) => {
    return _createDebtToken(loanFactory, tca, owner, pool, borrower, debt)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, depositor, tca] = wallets

    ; ({
      standardPool: pool,
      standardToken: poolToken,
      loanFactory,
      lender,
      liquidator,
      poolFactory,
      rateAdjuster,
      creditOracle,
      borrowingMutex,
      creditAgency,
    } = await setupTruefi2(owner, _provider))
    await loanFactory.setRateAdjuster(rateAdjuster.address)
    await creditOracle.setScore(borrower.address, 255)
    borrowerCreditScore = await creditOracle.score(borrower.address)

    await poolToken.mint(depositor.address, parseEth(10_000))
    await poolToken.connect(depositor).approve(pool.address, parseEth(10_000))
    await pool.connect(depositor).join(parseEth(10_000))

    loanToken = await createLoan(parseEth(1_000), 100)
  })

  describe('initializer', () => {
    it('sets poolFactory', async () => {
      expect(await loanFactory.poolFactory()).to.eq(poolFactory.address)
    })

    it('sets lender', async () => {
      expect(await loanFactory.lender()).to.eq(lender.address)
    })

    it('sets liquidator', async () => {
      expect(await loanFactory.liquidator()).to.eq(liquidator.address)
    })

    it('sets rateAdjuster', async () => {
      expect(await loanFactory.rateAdjuster()).to.eq(rateAdjuster.address)
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
    it('deploys loan token contract', async () => {
      expect(await loanToken.amount()).to.equal(parseEth(1_000))
      expect(await loanToken.term()).to.equal(100)
      expect(await loanToken.lender()).to.equal(lender.address)
      expect(await loanToken.liquidator()).to.equal(liquidator.address)
    })

    it('marks deployed contract as loan token', async () => {
      expect(await loanFactory.isLoanToken(loanToken.address)).to.be.true
    })

    it('prevents 0 loans', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, 0, 100, MAX_APY))
        .to.be.revertedWith('LoanFactory: Loans of amount 0, will not be approved')
    })

    it('prevents 0 time loans', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), 0, MAX_APY))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
    })

    it('prevents fake pool loans', async () => {
      const fakePool = await new TrueFiPool2__factory(owner).deploy()
      await expect(loanFactory.connect(borrower).createLoanToken(fakePool.address, parseEth(123), DAY, MAX_APY))
        .to.be.revertedWith('LoanFactory: Pool is not supported by PoolFactory')
    })

    it('prevents unsupported pool loans', async () => {
      await poolFactory.unsupportPool(pool.address)
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), DAY, MAX_APY))
        .to.be.revertedWith('LoanFactory: Pool is not supported by PoolFactory')
    })

    it('prevents apy higer than limit', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(1_000), 15 * DAY, 510))
        .to.be.revertedWith('LoanFactory: Calculated apy is higher than max apy')

      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(1_000), 15 * DAY, 511))
        .not.to.be.reverted
    })

    it('prevents token creation when there is no token implementation', async () => {
      const factory = await new LoanFactory2__factory(owner).deploy()
      const mockPoolFactory = await deployMockContract(owner, PoolFactoryJson.abi)
      await factory.initialize(
        mockPoolFactory.address,
        AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero,
      )
      await mockPoolFactory.mock.isSupportedPool.withArgs(AddressZero).returns(true)
      await expect(factory.connect(borrower).createLoanToken(AddressZero, parseEth(123), 15 * DAY, MAX_APY))
        .to.be.revertedWith('LoanFactory: Loan token implementation should be set')
    })

    it('fails when loan token intitialize signature differs from expected', async () => {
      const testLoanToken = await new TestLoanToken__factory(owner).deploy()
      await loanFactory.connect(owner).setLoanTokenImplementation(testLoanToken.address)
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), 15 * DAY, MAX_APY))
        .to.be.revertedWith('Transaction reverted: function selector was not recognized and there\'s no fallback function')
    })

    describe('apy is set properly', () => {
      const term = 15 * DAY

      describe('for different pro forma utilization ratios', () => {
        it('low pro forma utilization', async () => {
          const loan = await createLoan(parseEth(1_000), term)
          expect(await loan.apy()).to.equal(511)
        })

        it('mid pro forma utilization (some funds were removed from the pool)', async () => {
          await pool.connect(depositor).liquidExit(parseEth(5_000))
          const loan = await createLoan(parseEth(3_000), term)
          expect(await loan.apy()).to.equal(762)
        })

        it('high pro forma utilization', async () => {
          const loan = await createLoan(parseEth(8_000), term)
          expect(await loan.apy()).to.equal(1700)
        })
      })

      describe('for different terms', () => {
        let rateWithoutFixedTermLoanAdjustment: BigNumber
        let fixedTermLoanAdjustmentCoefficient: BigNumber

        const amount = parseEth(1_000)

        beforeEach(async () => {
          rateWithoutFixedTermLoanAdjustment = await rateAdjuster.rate(pool.address, borrowerCreditScore, amount)
          fixedTermLoanAdjustmentCoefficient = await rateAdjuster.fixedTermLoanAdjustmentCoefficient()
        })

        it('short term', async () => {
          const loan = await createLoan(amount, 15 * DAY)
          expect(await loan.apy())
            .to.equal(rateWithoutFixedTermLoanAdjustment)
        })

        it('mid term', async () => {
          const loan = await createLoan(amount, 45 * DAY)
          expect(await loan.apy())
            .to.equal(rateWithoutFixedTermLoanAdjustment.add(fixedTermLoanAdjustmentCoefficient))
        })

        it('long term', async () => {
          const loan = await createLoan(amount, 185 * DAY)
          expect(await loan.apy())
            .to.equal(rateWithoutFixedTermLoanAdjustment.add((fixedTermLoanAdjustmentCoefficient.mul(6))))
        })
      })
    })
  })

  describe('createDebtToken', () => {
    let debtToken

    beforeEach(async () => {
      debtToken = await createDebtToken(pool, borrower, parseEth(1))
    })

    describe('reverts if', () => {
      it('caller is not TCA', async () => {
        await expect(loanFactory.connect(borrower).createDebtToken(pool.address, borrower.address, parseEth(1)))
          .to.be.revertedWith('LoanFactory: Caller is not the credit agency')
      })

      it('there is no token implementation', async () => {
        const factory = await new LoanFactory2__factory(owner).deploy()
        await factory.initialize(
          AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero,
          tca.address,
        )
        await expect(factory.connect(tca).createDebtToken(pool.address, borrower.address, parseEth(1)))
          .to.be.revertedWith('LoanFactory: Debt token implementation should be set')
      })

      it('debt token intitialize signature differs from expected', async () => {
        const testLoanToken = await new TestLoanToken__factory(owner).deploy()
        await loanFactory.connect(owner).setDebtTokenImplementation(testLoanToken.address)
        await expect(loanFactory.connect(tca).createDebtToken(pool.address, borrower.address, parseEth(1)))
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
        expect(await debtToken.balanceOf(lender.address)).to.eq(parseEth(1))
      })

      it('marks deployed contract as debt token', async () => {
        expect(await loanFactory.isDebtToken(debtToken.address)).to.be.true
      })
    })
  })

  describe('isCreatedByFactory', () => {
    describe('returns true for', () => {
      it('loan token created by factory', async () => {
        const loanToken = await createLoan(parseEth(1), DAY)
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

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setCreditOracle(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set credit oracle to address(0)')
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

  describe('setRateAdjuster', () => {
    let fakeRateAdjuster: TrueRateAdjuster
    beforeEach(async () => {
      fakeRateAdjuster = await new TrueRateAdjuster__factory(owner).deploy()
      await fakeRateAdjuster.initialize(AddressZero)
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setRateAdjuster(fakeRateAdjuster.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setRateAdjuster(fakeRateAdjuster.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setRateAdjuster(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set rate adjuster to address(0)')
    })

    it('changes rateAdjuster', async () => {
      await loanFactory.setRateAdjuster(fakeRateAdjuster.address)
      expect(await loanFactory.rateAdjuster()).to.eq(fakeRateAdjuster.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setRateAdjuster(fakeRateAdjuster.address))
        .to.emit(loanFactory, 'RateAdjusterChanged')
        .withArgs(fakeRateAdjuster.address)
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

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setBorrowingMutex(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set borrowing mutex to address(0)')
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

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setLoanTokenImplementation(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set loan token implementation to address(0)')
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

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setCreditAgency(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set credit agency to address(0)')
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

  describe('setLender', () => {
    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setLender(lender.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setLender(lender.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
    })

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setLender(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set lender to address(0)')
    })

    it('changes lender', async () => {
      await loanFactory.setLender(owner.address)
      expect(await loanFactory.lender()).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(loanFactory.setLender(owner.address))
        .to.emit(loanFactory, 'LenderChanged')
        .withArgs(owner.address)
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

    it('cannot be set to address(0)', async () => {
      await expect(loanFactory.setDebtTokenImplementation(AddressZero))
        .to.be.revertedWith('LoanFactory: Cannot set debt token implementation to address(0)')
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
})
