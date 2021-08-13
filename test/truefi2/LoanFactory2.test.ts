import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth, setupTruefi2 } from 'utils'

import {
  LoanToken__factory,
  LoanFactory2,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2,
  Liquidator2,
  PoolFactory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
} from 'contracts'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('LoanFactory2', () => {
  let owner: Wallet
  let borrower: Wallet
  let lender: TrueLender2
  let liquidator: Liquidator2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let contractAddress: string
  let loanFactory: LoanFactory2

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets

    ;({
      standardPool: pool,
      loanFactory,
      lender,
      liquidator,
      poolFactory,
    } = await setupTruefi2(owner, _provider))

    const tx = await loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), 100, 200)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)
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
      const loanToken = LoanToken__factory.connect(contractAddress, owner)
      expect(await loanToken.amount()).to.equal(parseEth(123))
      expect(await loanToken.term()).to.equal(100)
      expect(await loanToken.apy()).to.equal(200)
      expect(await loanToken.lender()).to.equal(lender.address)
      expect(await loanToken.liquidator()).to.equal(liquidator.address)
    })

    it('marks deployed contract as loan token', async () => {
      expect(await loanFactory.isLoanToken(contractAddress)).to.be.true
    })

    it('prevents 0 loans', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, 0, 100, 200))
        .to.be.revertedWith('LoanFactory: Loans of amount 0, will not be approved')
    })

    it('prevents 0 time loans', async () => {
      await expect(loanFactory.connect(borrower).createLoanToken(pool.address, parseEth(123), 0, 200))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
    })

    it('prevents fake pool loans', async () => {
      const fakePool = await new TrueFiPool2__factory(owner).deploy()
      await expect(loanFactory.connect(borrower).createLoanToken(fakePool.address, parseEth(123), 0, 200))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
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
