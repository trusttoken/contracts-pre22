import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, DAY, parseEth } from 'utils'
import { setupDeploy } from 'scripts/utils'

import { AddressZero } from '@ethersproject/constants'

import {
  LoanToken__factory,
  MockErc20Token__factory,
  LoanFactory2,
  LoanFactory2__factory,
  PoolFactory,
  PoolFactory__factory,
  TrueFiPool2,
  ImplementationReference,
  TrueFiPool2__factory,
  ImplementationReference__factory,
  TrueRateAdjuster,
  TrueRateAdjuster__factory,
} from 'contracts'

import { solidity } from 'ethereum-waffle'

use(solidity)

describe('LoanFactory2', () => {
  let owner: Wallet
  let borrower: Wallet
  let lender: Wallet
  let liquidator: Wallet
  let poolFactory: PoolFactory
  let poolImplementation: TrueFiPool2
  let implementationReference: ImplementationReference
  let factory: LoanFactory2
  let rater: TrueRateAdjuster
  let poolAddress: string

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower, lender, liquidator] = wallets
    const token = await new MockErc20Token__factory(owner).deploy()

    const deployContract = setupDeploy(owner)

    factory = await deployContract(LoanFactory2__factory)
    poolFactory = await deployContract(PoolFactory__factory)
    poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    rater = await deployContract(TrueRateAdjuster__factory, 1000)

    await poolFactory.initialize(implementationReference.address, AddressZero, AddressZero)
    await factory.initialize(poolFactory.address, lender.address, liquidator.address, rater.address)

    await poolFactory.allowToken(token.address, true)
    await poolFactory.createPool(token.address)
    poolAddress = await poolFactory.pool(token.address)
  })

  describe('createLoanToken', () => {
    let contractAddress: string

    beforeEach(async () => {
      const tx = await factory.connect(borrower).createLoanToken(poolAddress, parseEth(123), 100, 200)
      const creationEvent = (await tx.wait()).events[0]
      ;({ contractAddress } = creationEvent.args)
    })

    it('deploys loan token contract', async () => {
      const loanToken = LoanToken__factory.connect(contractAddress, owner)
      expect(await loanToken.amount()).to.equal(parseEth(123))
      expect(await loanToken.term()).to.equal(100)
      expect(await loanToken.apy()).to.equal(200)
      expect(await loanToken.lender()).to.equal(lender.address)
      expect(await loanToken.liquidator()).to.equal(liquidator.address)
    })

    it('marks deployed contract as loan token', async () => {
      expect(await factory.isLoanToken(contractAddress)).to.be.true
    })

    it('prevents 0 loans', async () => {
      await expect(factory.connect(borrower).createLoanToken(poolAddress, 0, 100, 200))
        .to.be.revertedWith('LoanFactory: Loans of amount 0, will not be approved')
    })

    it('prevents 0 time loans', async () => {
      await expect(factory.connect(borrower).createLoanToken(poolAddress, parseEth(123), 0, 200))
        .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
    })

    it('prevents fake pool loans', async () => {
      const fakePool = await new TrueFiPool2__factory(owner).deploy()
      await expect(factory.connect(borrower).createLoanToken(fakePool.address, parseEth(123), 100, 200))
        .to.be.revertedWith('LoanFactory: Pool was not created by PoolFactory')
    })
  })

  describe('fixedTermLoanAdjustment', () => {
    beforeEach(async () => {
      await rater.setFixedTermLoanAdjustmentCoefficient(25)
    })

    ;[
      [0, 0],
      [30 * DAY - 1, 0],
      [30 * DAY, 25],
      [60 * DAY - 1, 25],
      [60 * DAY, 50],
    ].map(([term, adjustment]) =>
      it(`returns adjustment of ${adjustment} basis points for term of ${term / DAY} days`, async () => {
        expect(await factory.fixedTermLoanAdjustment(term)).to.eq(adjustment)
      }),
    )
  })
})
