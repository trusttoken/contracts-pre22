import { expect, use } from 'chai'
import { BigNumber, BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth, setupTruefi2WithLoanFactory3 } from 'utils'

import {
  LoanToken2__factory,
  LoanFactory3,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2,
  Liquidator2,
  PoolFactory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
  LoanToken2,
  MockTrueCurrency,
} from 'contracts'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('LoanFactory3', () => {
  let owner: Wallet
  let borrower: Wallet
  let lender: TrueLender2
  let liquidator: Liquidator2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let poolToken: MockTrueCurrency
  let contractAddress: string
  let loanFactory: LoanFactory3
  let loanToken: LoanToken2
  let rateAdjuster: TrueRateAdjuster
  let creditOracle: TrueFiCreditOracle
  let borrowerCreditScore: number

  const DAY = 60 * 60 * 24

  const createLoan = async (amount: BigNumberish, term: BigNumberish) => {
    const tx = await loanFactory.connect(borrower).createLoanToken(pool.address, amount, term)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)
    return LoanToken2__factory.connect(contractAddress, owner)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets

    ;({
      standardPool: pool,
      standardToken: poolToken,
      loanFactory,
      lender,
      liquidator,
      poolFactory,
      rateAdjuster,
      creditOracle,
    } = await setupTruefi2WithLoanFactory3(owner, _provider))

    await creditOracle.setScore(borrower.address, 255)
    borrowerCreditScore = await creditOracle.getScore(borrower.address)

    await poolToken.mint(pool.address, parseEth(10_000))
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
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, 0, 100))
        .to.be.revertedWith('LoanFactory: Loans of amount 0, will not be approved')
    })

    it('prevents 0 time loans', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), 0))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
    })

    it('prevents fake pool loans', async () => {
      const fakePool = await new TrueFiPool2__factory(owner).deploy()
      await expect(loanFactory.connect(borrower).createLoanToken(fakePool.address, parseEth(123), 0))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
    })

    describe('apy is set properly', () => {
      const term = 15 * DAY

      describe('for different pro forma utilization ratios', () => {
        it('low pro forma utilization', async () => {
          const loan = await createLoan(parseEth(1_000), term)
          expect(await loan.apy()).to.equal(511)
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
          rateWithoutFixedTermLoanAdjustment = await rateAdjuster.proFormaRate(pool.address, borrowerCreditScore, amount)
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
      await fakeRateAdjuster.initialize()
    })

    it('only admin can call', async () => {
      await expect(loanFactory.connect(owner).setRateAdjuster(fakeRateAdjuster.address))
        .not.to.be.reverted
      await expect(loanFactory.connect(borrower).setRateAdjuster(fakeRateAdjuster.address))
        .to.be.revertedWith('LoanFactory: Caller is not the admin')
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
})
