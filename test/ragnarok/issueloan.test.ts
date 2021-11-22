import { expect } from 'chai'
import { Wallet } from 'ethers'

import {
  BulletLoans,
  BulletLoans__factory,
  ManagedPortfolio,
  ManagedPortfolio__factory,
  MockUsdc,
  MockUsdc__factory,
} from 'contracts'

import { beforeEachWithFixture, parseUSDC } from 'utils'

describe('Issuing a loan', () => {
  let portfolio: ManagedPortfolio
  let portfolioAsLender: ManagedPortfolio
  let bulletLoans: BulletLoans

  let token: MockUsdc
  let tokenAsLender: MockUsdc

  let portfolioOwner: Wallet
  let lender: Wallet
  let borrower: Wallet

  beforeEachWithFixture(async (wallets) => {
    [portfolioOwner, lender, borrower] = wallets

    token = await new MockUsdc__factory(portfolioOwner).deploy()
    bulletLoans = await new BulletLoans__factory(portfolioOwner).deploy()
    portfolio = await new ManagedPortfolio__factory(portfolioOwner).deploy(
      token.address,
      bulletLoans.address,
    )

    portfolioAsLender = portfolio.connect(lender)
    tokenAsLender = token.connect(lender)
    await token.mint(lender.address, parseUSDC(10))
  })

  it('joining a portfolio', async () => {
    await tokenAsLender.approve(portfolio.address, parseUSDC(10))
    await portfolioAsLender.join(parseUSDC(10))

    expect(await token.balanceOf(portfolio.address)).to.eq(parseUSDC(10))
  })

  describe('creating bullet loan ', () => {
    it('transfers funds to the borrower', async () => {
      await joinPortfolio(10)
      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))

      expect(await token.balanceOf(borrower.address)).to.eq(parseUSDC(5))
    })

    it('emits a proper event', async () => {
      await joinPortfolio(10)
      await expect(portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.emit(portfolio, 'BulletLoanCreated')
        .withArgs(0)
    })

    it('portfolio owns loan NFT', async () => {
      await joinPortfolio(10)
      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))
      expect(await bulletLoans.ownerOf(0)).to.equal(portfolio.address)
    })
  })

  it('withdrawal sends tokens back to the lender', async () => {
    await joinPortfolio(10)

    await portfolioAsLender.withdraw(parseUSDC(5))

    expect(await token.balanceOf(lender.address)).to.eq(parseUSDC(5))
  })

  async function joinPortfolio (amount: number) {
    await tokenAsLender.approve(portfolio.address, parseUSDC(amount))
    await portfolioAsLender.join(parseUSDC(amount))
  }
})
