import { expect, use } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth } from 'utils'

import {
  MockLoanFactory,
  LoanToken__factory,
  MockErc20Token__factory,
  MockLoanFactory__factory,
} from 'contracts'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('LoanFactory', () => {
  let owner: Wallet, borrower: Wallet
  let contractAddress: string
  let factory: MockLoanFactory

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets
    const token = await new MockErc20Token__factory(owner).deploy()
    factory = await new MockLoanFactory__factory(owner).deploy()
    await factory.initialize(token.address)
    await factory['setLender(address)'](owner.address)
    const tx = await factory.connect(borrower).createLoanToken(parseEth(123), 100, 200)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)
  })

  it('deploys loan token contract', async () => {
    const loanToken = LoanToken__factory.connect(contractAddress, owner)
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
