import { expect } from 'chai'
import { Wallet } from 'ethers'
import { parseEther } from '@ethersproject/units'

import { beforeEachWithFixture } from 'utils'

import {
  LoanFactory,
  LoanTokenFactory,
  MockErc20TokenFactory,
  LoanFactoryFactory,
} from 'contracts'

describe('LoanFactory', () => {
  let owner: Wallet, borrower: Wallet
  let contractAddress: string
  let factory: LoanFactory

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower] = wallets
    const token = await new MockErc20TokenFactory(owner).deploy()
    factory = await new LoanFactoryFactory(owner).deploy()
    await factory.initialize(token.address)
    const tx = await factory.createLoanToken(borrower.address, parseEther('123'), 100, 200)
    const creationEvent = (await tx.wait()).events[0]
    ;({ contractAddress } = creationEvent.args)
  })

  it('deploys loan token contract', async () => {
    const loanToken = LoanTokenFactory.connect(contractAddress, owner)
    expect(await loanToken.amount()).to.equal(parseEther('123'))
    expect(await loanToken.term()).to.equal(100)
    expect(await loanToken.apy()).to.equal(200)
  })

  it('marks deployed contract as loan token', async () => {
    expect(await factory.isLoanToken(contractAddress)).to.be.true
  })
})
