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
import { describe } from 'mocha'

import { beforeEachWithFixture, parseEth, parseUSDC, DAY, YEAR, timeTravel } from 'utils'
import { MockProvider } from '@ethereum-waffle/provider'

describe('ManagedPortfolio', () => {
  let provider: MockProvider

  let portfolio: ManagedPortfolio
  let portfolioAsLender: ManagedPortfolio
  let bulletLoans: BulletLoans

  let token: MockUsdc
  let tokenAsLender: MockUsdc

  let portfolioOwner: Wallet
  let lender: Wallet
  let lender2: Wallet
  let lender3: Wallet
  let borrower: Wallet

  const GRACE_PERIOD = DAY
  const parseShares = parseEth

  beforeEachWithFixture(async (wallets, _provider) => {
    [portfolioOwner, lender, lender2, lender3, borrower] = wallets
    provider = _provider

    token = await new MockUsdc__factory(portfolioOwner).deploy()
    bulletLoans = await new BulletLoans__factory(portfolioOwner).deploy()
    portfolio = await new ManagedPortfolio__factory(portfolioOwner).deploy(
      token.address,
      bulletLoans.address,
      YEAR
    )

    portfolioAsLender = portfolio.connect(lender)
    tokenAsLender = token.connect(lender)

    await token.mint(lender.address, parseUSDC(100))
    await token.mint(lender2.address, parseUSDC(100))
    await token.mint(lender3.address, parseUSDC(100))
  })

  describe('constructor parameters', () => {
    it('sets underlyingToken', async () => {
      expect(await portfolio.underlyingToken()).to.equal(token.address)
    })

    it('sets bulletLoans', async () => {
      expect(await portfolio.bulletLoans()).to.equal(bulletLoans.address)
    })

    it('sets endDate', async () => {
      const deployTx = await portfolio.deployTransaction.wait()
      const creationTimestamp = (await provider.getBlock(deployTx.blockHash)).timestamp
      expect(await portfolio.endDate()).to.equal(creationTimestamp + YEAR)
    })
  })

  describe('deposit', () => {
    it('lender cannot deposit after portfolio endDate', async () => {
      timeTravel(provider, YEAR + DAY)
      await tokenAsLender.approve(portfolio.address, parseUSDC(10))
      await expect(portfolioAsLender.deposit(parseUSDC(10))).to.be.revertedWith('ManagedPortfolio: Cannot deposit after portfolio end date')
    })

    it('transfers tokens to portfolio', async () => {
      await tokenAsLender.approve(portfolio.address, parseUSDC(10))
      await portfolioAsLender.deposit(parseUSDC(10))

      expect(await token.balanceOf(portfolio.address)).to.equal(parseUSDC(10))
    })

    it('issues portfolio share tokens', async () => {
      await depositIntoPortfolio(10, lender)

      expect(await portfolio.balanceOf(lender.address)).to.equal(parseShares(10))
    })

    it('issues tokens for the second lender', async () => {
      await depositIntoPortfolio(10, lender)
      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))

      await depositIntoPortfolio(10, lender2)

      expect(await portfolio.balanceOf(lender2.address)).to.equal(parseShares(20))
    })

    it('issues correct shares after pool value grows', async () => {
      await depositIntoPortfolio(10, lender)
      await token.mint(portfolio.address, parseUSDC(5))

      await depositIntoPortfolio(10, lender2)

      expect(await portfolio.balanceOf(lender.address)).to.equal(parseShares(10))
      expect(await portfolio.balanceOf(lender2.address)).to.equal(parseShares(10).mul(10).div(15))
    })

    it('issues fewer shares per token deposited after the pool value grows', async () => {
      await depositIntoPortfolio(10, lender)
      await depositIntoPortfolio(30, lender2)
      expect(await portfolio.balanceOf(lender.address)).to.equal(parseShares(10))
      expect(await portfolio.balanceOf(lender2.address)).to.equal(parseShares(30))

      await token.mint(portfolio.address, parseUSDC(40)) // Doubles the pool value

      await depositIntoPortfolio(10, lender)
      await depositIntoPortfolio(20, lender2)
      await depositIntoPortfolio(20, lender3)
      expect(await portfolio.balanceOf(lender.address)).to.equal(parseShares(10 + 5))
      expect(await portfolio.balanceOf(lender2.address)).to.equal(parseShares(30 + 10))
      expect(await portfolio.balanceOf(lender3.address)).to.equal(parseShares(10))
    })
  })

  describe('createBulletLoan', () => {
    it('transfers funds to the borrower', async () => {
      await depositIntoPortfolio(10)
      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))

      expect(await token.balanceOf(borrower.address)).to.equal(parseUSDC(5))
    })

    it('emits a proper event', async () => {
      await depositIntoPortfolio(10)

      await expect(portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.emit(portfolio, 'BulletLoanCreated')
        .withArgs(0)
    })

    it('mints an NFT', async () => {
      await depositIntoPortfolio(10)

      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))

      expect(await bulletLoans.ownerOf(0)).to.equal(portfolio.address)
    })

    it('cannot create a loan after portfolio endDate', async () => {
      await depositIntoPortfolio(10)
      await timeTravel(provider, YEAR);
      await expect(portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.be.revertedWith("ManagedPortfolio: Portfolio end date is in the past")
    })

    it('cannot create a loan with the endDate greater than Portfolio endDate', async () => {
      await depositIntoPortfolio(10)
      await expect(portfolio.createBulletLoan(YEAR - GRACE_PERIOD + 1, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.be.revertedWith("ManagedPortfolio: Loan end date is greater than Portfolio end date")
    })
  })

  it('withdraw sends tokens back to the lender', async () => {
    await depositIntoPortfolio(100)

    await portfolioAsLender.withdraw(parseUSDC(50))

    expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(50))
  })

  async function depositIntoPortfolio(amount: number, wallet: Wallet = lender) {
    await token.connect(wallet).approve(portfolio.address, parseUSDC(amount))
    await portfolio.connect(wallet).deposit(parseUSDC(amount))
  }
})
