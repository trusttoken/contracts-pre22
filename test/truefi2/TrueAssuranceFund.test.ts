import { expect } from 'chai'
import { loadFixture, MockProvider } from 'ethereum-waffle'
import { trueFi2Fixture } from 'fixtures/trueFi2'
import { LoanToken2, MockTrueCurrency, TrueAssuranceFund, TrueFiPool2, TrueLender2 } from 'contracts'
import { DAY, parseEth, timeTravel } from 'utils'
import { Wallet } from 'ethers'

describe('TrueAssuranceFund', () => {
  let safu: TrueAssuranceFund
  let token: MockTrueCurrency
  let loan: LoanToken2
  let provider: MockProvider
  let owner: Wallet, borrower: Wallet
  let pool: TrueFiPool2
  let lender: TrueLender2
  const defaultAmount = parseEth(1100)

  beforeEach(async () => {
    ({ safu, token, loan, provider, owner, pool, borrower, lender } = await loadFixture(trueFi2Fixture))
    await token.mint(safu.address, defaultAmount)
    await pool.connect(owner).join(parseEth(1e7))
    await lender.connect(borrower).fund(loan.address)
  })

  it('transfers total loan amount to the pool', async () => {
    await timeTravel(provider, DAY * 400)
    await loan.enterDefault()
    await safu.liquidate(loan.address)
    expect(await token.balanceOf(safu.address)).to.equal(0)
  })
})
