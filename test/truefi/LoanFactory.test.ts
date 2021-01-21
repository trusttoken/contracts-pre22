import { expect } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth } from 'utils'

import {
  MockLoanFactory,
  LoanTokenFactory,
  MockErc20TokenFactory,
  MockLoanFactoryFactory,
} from 'contracts'

describe('LoanFactory', () => {
  let owner: Wallet, borrower: Wallet
  let contractAddress: string
  let factory: MockLoanFactory

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets
    const token = await new MockErc20TokenFactory(owner).deploy()
    factory = await new MockLoanFactoryFactory(owner).deploy()
    await factory.initialize(token.address)
    await factory['setLender(address)'](owner.address)
    const tx = await factory.connect(borrower).createLoanToken(parseEth(123), 100, 200)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)
  })

  it('deploys loan token contract', async () => {
    const loanToken = LoanTokenFactory.connect(contractAddress, owner)
    expect(await loanToken.amount()).to.equal(parseEth(123))
    expect(await loanToken.term()).to.equal(100)
    expect(await loanToken.apy()).to.equal(200)
    expect(await loanToken.lender()).to.equal(owner.address)
  })

  it('marks deployed contract as loan token', async () => {
    expect(await factory.isLoanToken(contractAddress)).to.be.true
  })

  it('prevents 0 loans', async () => {
    await expect(factory.connect(borrower).createLoanToken(0, 100, 200))
      .to.be.revertedWith('LoanFactory: Loans of amount 0, will not be approved')
  })

  it('prevents 0 time loans', async () => {
    await expect(factory.connect(borrower).createLoanToken(parseEth(123), 0, 200))
      .to.be.revertedWith('LoanFactory: Loans cannot have instantaneous term of repay')
  })
})
