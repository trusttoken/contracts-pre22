import { expect } from 'chai'
import { Wallet } from 'ethers'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { LoanToken } from '../../build/types/LoanToken'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { MockProvider } from 'ethereum-waffle'
import { parseEther } from 'ethers/utils'
import { timeTravel } from '../utils/timeTravel'

describe('LoanToken', () => {
  enum LoanTokenStatus {Awaiting, Funded, Withdrawn, Closed}

  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let loanToken: LoanToken
  let tusd: MockTrueCurrency

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loanToken.connect(wallet).withdraw(beneficiary)

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, borrower] = wallets
    provider = _provider

    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()
    await tusd.mint(owner.address, parseEther('100000000'))

    loanToken = await new LoanTokenFactory(owner).deploy(
      tusd.address,
      borrower.address,
      parseEther('1000'),
      monthInSeconds * 12,
      1000,
    )

    await tusd.approve(loanToken.address, parseEther('100000000'))
  })

  it('isLoanToken', async () => {
    expect(await loanToken.isLoanToken()).to.be.true
  })

  describe('Constructor', () => {
    it('sets the currency token address', async () => {
      expect(await loanToken.currencyToken()).to.equal(tusd.address)
    })

    it('sets loan params', async () => {
      expect(await loanToken.borrower()).to.equal(borrower.address)
      expect(await loanToken.amount()).to.equal(parseEther('1000'))
      expect(await loanToken.duration()).to.equal(monthInSeconds * 12)
      expect(await loanToken.apy()).to.equal(1000)
      expect(await loanToken.start()).to.be.equal(0)
      expect(await loanToken.isLoanToken()).to.be.true
    })

    it('sets borrowers debt', async () => {
      expect(await loanToken.debt()).to.equal(parseEther('1100'))
    })
  })

  describe('Fund', () => {
    let creationTimestamp: number

    beforeEach(async () => {
      const tx = await loanToken.fund()
      const { blockNumber } = await tx.wait()
      creationTimestamp = (await provider.getBlock(blockNumber)).timestamp
    })

    it('sets status to Funded', async () => {
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Funded)
    })

    it('sets loan start timestamp', async () => {
      expect(await loanToken.start()).to.equal(creationTimestamp)
    })

    it('mints funders loan tokens', async () => {
      expect(await loanToken.balanceOf(owner.address)).to.equal(parseEther('1100'))
      expect(await loanToken.totalSupply()).to.equal(parseEther('1100'))
    })

    it('transfers proper amount of currency token from funder to loanToken contact', async () => {
      expect(await tusd.balanceOf(loanToken.address)).to.equal(parseEther('1000'))
    })

    it('reverts when funding the same loan token twice', async () => {
      await expect(loanToken.fund())
        .to.be.revertedWith('LoanToken: current status should be Awaiting')
    })
  })

  describe('Withdraw', () => {
    it('borrower can take funds from loan token', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await tusd.balanceOf(borrower.address)).to.equal(parseEther('1000'))
    })

    it('transfers funds to beneficiary', async () => {
      await loanToken.fund()
      const randomAddress = Wallet.createRandom().address
      await withdraw(borrower, randomAddress)
      expect(await tusd.balanceOf(randomAddress)).to.equal(parseEther('1000'))
    })

    it('reverts if trying to withdraw twice', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: current status should be Funded')
    })

    it('reverts when withdrawing from not funded loan', async () => {
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: current status should be Funded')
    })

    it('reverts when withdrawing from not closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await loanToken.close()
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: current status should be Funded')
    })

    it('reverts when sender is not a borrower', async () => {
      await loanToken.fund()
      await expect(withdraw(owner)).to.be.revertedWith('LoanToken: caller is not the borrower')
    })
  })

  describe('Close', () => {
    it('sets status to Closed', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Closed)
    })

    it('saves returned amount', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await withdraw(borrower)
      await loanToken.close()
      expect(await loanToken.returned()).to.equal(0)
    })

    it('reverts when closing not funded loan', async () => {
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: current status should be Funded')
    })

    it('reverts when closing ongoing loan', async () => {
      await loanToken.fund()
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: loan cannot be closed yet')
      await timeTravel(provider, monthInSeconds * 12 - 10)
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: loan cannot be closed yet')
    })

    it('reverts when trying to close already closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await loanToken.close()
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: current status should be Funded')
    })
  })

  describe('Redeem', () => {
    describe('When loan succeeds', () => {})
    describe('When loan defaults', () => {})
  })
})
