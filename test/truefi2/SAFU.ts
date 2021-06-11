import { expect } from 'chai'
import { loadFixture, MockProvider } from 'ethereum-waffle'
import { trueFi2Fixture } from 'fixtures/trueFi2'
import { DAY, parseEth, timeTravel } from 'utils'
import { Wallet } from 'ethers'

import {
  LoanFactory2,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  SAFU,
  TrueFiPool2,
  TrueLender2,
} from 'contracts'

describe('SAFU', () => {
  let safu: SAFU
  let token: MockTrueCurrency
  let loan: LoanToken2
  let loanFactory: LoanFactory2
  let provider: MockProvider
  let owner: Wallet, borrower: Wallet
  let pool: TrueFiPool2
  let lender: TrueLender2
  const defaultAmount = parseEth(1100)

  beforeEach(async () => {
    ({ safu, token, loan, provider, owner, pool, borrower, lender, loanFactory } = await loadFixture(trueFi2Fixture))
    await token.mint(safu.address, defaultAmount)
    await pool.connect(owner).join(parseEth(1e7))
    await lender.connect(borrower).fund(loan.address)
    await safu.initialize(loanFactory.address)
  })

  it('transfers total loan amount to the pool', async () => {
    await timeTravel(provider, DAY * 400)
    await loan.enterDefault()
    await safu.liquidate(loan.address)
    expect(await token.balanceOf(safu.address)).to.equal(0)
  })

  it('fails if loan is not defaulted', async () => {
    await expect(safu.liquidate(loan.address)).to.be.revertedWith('SAFU: Loan is not defaulted')
  })

  it('fails if loan is not created by factory', async () => {
    const strangerLoan = await new LoanToken2__factory(owner).deploy(pool.address, owner.address, owner.address, owner.address, 1000, 1, 1)
    await expect(safu.liquidate(strangerLoan.address)).to.be.revertedWith('SAFU: Unknown loan')
  })
})
