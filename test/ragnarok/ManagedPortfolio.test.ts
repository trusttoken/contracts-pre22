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

import { parseEth, parseUSDC, DAY, YEAR, timeTravel } from 'utils'
import { MockProvider } from '@ethereum-waffle/provider'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { arrayify, solidityKeccak256 } from 'ethers/lib/utils'

const TEN_PERCENT = 1000
const DEPOSIT_MESSAGE = 'deposit message'
const HASHED_MESSAGE = solidityKeccak256(['string'], [DEPOSIT_MESSAGE])

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
  let manager: Wallet

  const GRACE_PERIOD = DAY
  const parseShares = parseEth

  beforeEachWithFixture(async (wallets, _provider) => {
    [portfolioOwner, lender, lender2, lender3, borrower, manager] = wallets
    provider = _provider

    token = await new MockUsdc__factory(portfolioOwner).deploy()
    bulletLoans = await new BulletLoans__factory(portfolioOwner).deploy()
    portfolio = await new ManagedPortfolio__factory(portfolioOwner).deploy(
      token.address,
      bulletLoans.address,
      YEAR,
      parseUSDC(1e7),
      TEN_PERCENT,
      manager.address,
      DEPOSIT_MESSAGE,
    )

    portfolioAsLender = portfolio.connect(lender)
    tokenAsLender = token.connect(lender)

    await token.mint(lender.address, parseUSDC(100))
    await token.mint(lender2.address, parseUSDC(100))
    await token.mint(lender3.address, parseUSDC(100))
  })

  describe('constructor parameters', () => {
    it('sets owner', async () => {
      expect(await portfolio.owner()).to.equal(portfolioOwner.address)
    })

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

    it('manager fee', async () => {
      expect(await portfolio.managerFee()).to.equal(TEN_PERCENT)
    })

    it('manager', async () => {
      expect(await portfolio.manager()).to.equal(manager.address)
    })

    it('sets hashed deposit message', async () => {
      expect(await portfolio.hashedDepositMessage()).to.equal(HASHED_MESSAGE)
    })
  })

  describe('setManagerFee', () => {
    it('sets the manager fee', async () => {
      await portfolio.connect(manager).setManagerFee(2000)
      expect(await portfolio.managerFee()).to.equal(2000)
    })

    it('emits a ManagerFeeSet event', async () => {
      await expect(portfolio.connect(manager).setManagerFee(2000))
        .to.emit(portfolio, 'ManagerFeeChanged').withArgs(2000)
    })

    it('only manager can set fees', async () => {
      await expect(portfolio.connect(lender).setManagerFee(2000)).to.be.revertedWith(
        'ManagedPortfolio: Only manager can set manager fee',
      )
    })
  })

  describe('deposit', () => {
    beforeEach(async () => {
      await portfolio.connect(manager).setManagerFee(0)
    })

    it('lender cannot deposit after portfolio endDate', async () => {
      await timeTravel(provider, YEAR + DAY)
      await tokenAsLender.approve(portfolio.address, parseUSDC(10))
      const signature = await signMessage(lender, DEPOSIT_MESSAGE)
      await expect(portfolioAsLender.deposit(parseUSDC(10), signature)).to.be.revertedWith('ManagedPortfolio: Cannot deposit after portfolio end date')
    })

    it('reverts if lender\'s signature is invalid', async () => {
      const signature = await signMessage(lender, 'other message')
      await expect(portfolioAsLender.deposit(parseUSDC(10), signature)).to.be.revertedWith('ManagedPortfolio: Signature is invalid')
    })

    it('transfers tokens to portfolio', async () => {
      await depositIntoPortfolio(10, lender)
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

    it('causes totalDeposited to increase', async () => {
      expect(await portfolio.totalDeposited()).to.equal(parseUSDC(0))
      await depositIntoPortfolio(10, lender)
      expect(await portfolio.totalDeposited()).to.equal(parseUSDC(10))
    })
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await portfolio.connect(manager).setManagerFee(0)
    })

    it('cannot withdraw when portfolio is not closed', async () => {
      await depositIntoPortfolio(100)

      await expect(portfolioAsLender.withdraw(parseShares(50)))
        .to.be.revertedWith('ManagedPortfolio: Cannot withdraw when Portfolio is not closed')
    })

    it('sends tokens back to the lender', async () => {
      await depositIntoPortfolio(100)

      await timeTravel(provider, YEAR + DAY)
      await portfolioAsLender.withdraw(parseShares(50))

      expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(50))
    })

    it('burns proper amount of pool tokens', async () => {
      await depositIntoPortfolio(100)

      expect(await portfolio.totalSupply()).to.equal(parseShares(100))

      await timeTravel(provider, YEAR + DAY)
      await portfolioAsLender.withdraw(parseShares(50))

      expect(await portfolio.balanceOf(lender.address)).to.equal(parseShares(50))
      expect(await portfolio.totalSupply()).to.equal(parseShares(50))
    })

    it('sends correct number of tokens back to lender after portfolio value has grown', async () => {
      await depositIntoPortfolio(100)
      await token.mint(portfolio.address, parseUSDC(100)) // Double the pool value

      await timeTravel(provider, YEAR + DAY)
      await portfolioAsLender.withdraw(parseShares(50))
      expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(100))
      await portfolioAsLender.withdraw(parseShares(50))
      expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(200))
    })

    it('sends correct number of tokens back to two lenders', async () => {
      await depositIntoPortfolio(100)
      await depositIntoPortfolio(100, lender2)
      await token.mint(portfolio.address, parseUSDC(100))

      await timeTravel(provider, YEAR + DAY)
      await portfolioAsLender.withdraw(parseShares(50))
      expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(75))
      await portfolio.connect(lender2).withdraw(parseShares(50))
      expect(await token.balanceOf(lender.address)).to.equal(parseUSDC(75))
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
      await timeTravel(provider, YEAR)
      await expect(portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.be.revertedWith('ManagedPortfolio: Portfolio end date is in the past')
    })

    it('cannot create a loan with the endDate greater than Portfolio endDate', async () => {
      await depositIntoPortfolio(10)
      await expect(portfolio.createBulletLoan(YEAR - GRACE_PERIOD + 1, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.be.revertedWith('ManagedPortfolio: Loan end date is greater than Portfolio end date')
    })

    it('only manager can create a loan', async () => {
      await depositIntoPortfolio(10)
      await expect(portfolio.connect(borrower).createBulletLoan(YEAR - GRACE_PERIOD + 1, borrower.address, parseUSDC(5), parseUSDC(6)))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('transfers manager fee to the manager', async () => {
      await depositIntoPortfolio(10)
      await portfolio.createBulletLoan(0, borrower.address, parseUSDC(5), parseUSDC(6))

      expect(await token.balanceOf(manager.address)).to.equal(parseUSDC(0.5))
    })
  })

  describe('maxSize', () => {
    it('prevents deposit if total after deposit > maxSize', async () => {
      await portfolio.setMaxSize(0)
      return expect(depositIntoPortfolio(10, lender)).to.be.revertedWith('ManagedPortfolio: Portfolio is full')
    })

    it('allows deposit if total after deposit = maxSize', async () => {
      await portfolio.setMaxSize(parseUSDC(100))
      await expect(depositIntoPortfolio(100, lender)).not.to.be.reverted
    })

    it('allows multiple deposits until total after deposit > maxSize', async () => {
      await portfolio.setMaxSize(parseUSDC(100))
      await expect(depositIntoPortfolio(50, lender)).not.to.be.reverted
      await expect(depositIntoPortfolio(50, lender2)).not.to.be.reverted
      await expect(depositIntoPortfolio(50, lender)).to.be.revertedWith('ManagedPortfolio: Portfolio is full')
    })

    it('whether portfolio is full depends on total amount deposited, not amount of underlying token', async () => {
      await portfolio.connect(manager).setManagerFee(0)
      await portfolio.setMaxSize(parseUSDC(110))
      await depositIntoPortfolio(100)
      await portfolio.createBulletLoan(DAY * 30, borrower.address, parseUSDC(100), parseUSDC(106))

      await expect(depositIntoPortfolio(100, lender)).to.be.revertedWith('ManagedPortfolio: Portfolio is full')
    })

    it('only owner is allowed to change maxSize', async () => {
      await expect(portfolio.connect(lender).setMaxSize(0)).to.be.revertedWith('Ownable: caller is not the owner')
      await expect(portfolio.connect(portfolioOwner).setMaxSize(0)).not.to.be.reverted
    })
  })

  describe('isClosed', () => {
    it('returns false if end date has not elapsed', async () => {
      expect(await portfolio.isClosed()).to.be.false
      await timeTravel(provider, YEAR - DAY)
      expect(await portfolio.isClosed()).to.be.false
    })

    it('returns true if end date has elapsed', async () => {
      await timeTravel(provider, YEAR + DAY)
      expect(await portfolio.isClosed()).to.be.true
    })
  })

  describe('isSignatureValid', () => {
    it('returns true for valid signature', async () => {
      const signature = await signMessage(lender, DEPOSIT_MESSAGE)
      expect(await portfolio.isSignatureValid(lender.address, signature)).to.be.true
    })

    it('returns false for invalid message', async () => {
      const signature = await signMessage(lender, 'other message')
      expect(await portfolio.isSignatureValid(lender.address, signature)).to.be.false
    })

    it('returns false for invalid signer', async () => {
      const signature = await signMessage(manager, DEPOSIT_MESSAGE)
      expect(await portfolio.isSignatureValid(lender.address, signature)).to.be.false
    })
  })

  const signMessage = async (wallet: Wallet, message: string) => {
    const hashedMessage = solidityKeccak256(['string'], [message])
    return wallet.signMessage(arrayify(hashedMessage))
  }

  const depositIntoPortfolio = async (amount: number, wallet: Wallet = lender) => {
    await token.connect(wallet).approve(portfolio.address, parseUSDC(amount))
    const signature = await signMessage(wallet, DEPOSIT_MESSAGE)
    await portfolio.connect(wallet).deposit(parseUSDC(amount), signature)
  }
})
