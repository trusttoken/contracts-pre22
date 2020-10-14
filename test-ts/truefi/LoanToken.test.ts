import { expect } from 'chai'
import { ContractTransaction, Wallet } from 'ethers'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { LoanToken } from '../../build/types/LoanToken'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { MockProvider } from 'ethereum-waffle'
import { BigNumberish } from 'ethers'
import { formatEther, parseEther } from '@ethersproject/units'
import { timeTravel } from '../utils/timeTravel'

describe('LoanToken', () => {
  enum LoanTokenStatus {Awaiting, Funded, Withdrawn, Settled, Defaulted}

  let provider: MockProvider
  let lender: Wallet
  let borrower: Wallet
  let other: Wallet
  let loanToken: LoanToken
  let tusd: MockTrueCurrency

  const dayInSeconds = 60 * 60 * 24
  const monthInSeconds = dayInSeconds * 30

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loanToken.connect(wallet).withdraw(beneficiary)

  const payback = async (wallet: Wallet, amount: BigNumberish) =>
    tusd.connect(wallet).transfer(loanToken.address, amount)

  beforeEachWithFixture(async (wallets, _provider) => {
    [lender, borrower, other] = wallets
    provider = _provider

    tusd = await new MockTrueCurrencyFactory(lender).deploy()
    await tusd.initialize()
    await tusd.mint(lender.address, parseEther('1000'))

    loanToken = await new LoanTokenFactory(lender).deploy(
      tusd.address,
      borrower.address,
      parseEther('1000'),
      monthInSeconds * 12,
      1000,
    )

    await tusd.approve(loanToken.address, parseEther('1000'))
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
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Awaiting)
    })

    it('sets borrowers debt', async () => {
      expect(await loanToken.debt()).to.equal(parseEther('1100'))
    })
  })

  describe('Fund', () => {
    let creationTimestamp: number
    let tx: ContractTransaction

    beforeEach(async () => {
      tx = await loanToken.fund()
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
      expect(await loanToken.balanceOf(lender.address)).to.equal(parseEther('1100'))
      expect(await loanToken.totalSupply()).to.equal(parseEther('1100'))
    })

    it('transfers proper amount of currency token from funder to loanToken contact', async () => {
      expect(await tusd.balanceOf(loanToken.address)).to.equal(parseEther('1000'))
    })

    it('reverts when funding the same loan token twice', async () => {
      await expect(loanToken.fund())
        .to.be.revertedWith('LoanToken: current status should be Awaiting')
    })

    it('emits event', async () => {
      await expect(Promise.resolve(tx)).to.emit(loanToken, 'Funded').withArgs(lender.address)
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

    it('sets status to Withdrawn', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Withdrawn)
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
      await expect(withdraw(lender)).to.be.revertedWith('LoanToken: caller is not the borrower')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await expect(withdraw(borrower)).to.emit(loanToken, 'Withdrawn').withArgs(borrower.address)
    })
  })

  describe('Close', () => {
    it('sets status to Defaulted if no debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, monthInSeconds * 12)
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Defaulted if not whole debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, monthInSeconds * 12)
      await tusd.mint(loanToken.address, parseEther('1099'))
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Settled if whole debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, monthInSeconds * 12)
      await tusd.mint(loanToken.address, parseEther('1100'))
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
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

    it('emits event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.mint(loanToken.address, parseEther('1099'))
      await timeTravel(provider, monthInSeconds * 12)
      await expect(loanToken.close()).to.emit(loanToken, 'Closed').withArgs(LoanTokenStatus.Defaulted, parseEther('1099'))
    })
  })

  describe('Repay', () => {
    it('reverts if called before withdraw', async () => {
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken: only after loan has been withdrawn')
      await loanToken.fund()
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken: only after loan has been withdrawn')
    })

    it('transfers trueCurrencies to loanToken', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.connect(borrower).approve(loanToken.address, parseEther('100'))
      await loanToken.repay(borrower.address, parseEther('100'))

      expect(await tusd.balanceOf(borrower.address)).to.equal(parseEther('900'))
      expect(await tusd.balanceOf(loanToken.address)).to.equal(parseEther('100'))
    })
  })

  describe('Redeem', () => {
    beforeEach(async () => {
      await tusd.mint(borrower.address, parseEther('100'))
    })

    it('reverts if called before loan is closed', async () => {
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: current status should be Settled or Defaulted')
      await loanToken.fund()
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: current status should be Settled or Defaulted')
      await withdraw(borrower)
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: current status should be Settled or Defaulted')
    })

    it('reverts if redeeming more than own balance', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await payback(borrower, parseEther('100'))
      await expect(loanToken.redeem(parseEther('1100'))).to.be.revertedWith('LoanToken: current status should be Settled or Defaulted')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await timeTravel(provider, monthInSeconds * 12)
      await loanToken.close()
      await expect(loanToken.redeem(parseEther('1100'))).to.emit(loanToken, 'Redeemed').withArgs(lender.address, parseEther('1100'), parseEther('1000'))
    })

    describe('Simple case: loan settled, redeem all', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, monthInSeconds * 12)
        await payback(borrower, parseEther('100'))
        await loanToken.close()
        await loanToken.redeem(parseEther('1100'))
      })

      it('transfers all trueCurrency tokens to lender', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('1100'))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await loanToken.repaid()).to.equal(parseEther('1100'))
      })
    })

    describe('loan defaulted (3/4 paid back), redeem all', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, monthInSeconds * 12)
        await withdraw(borrower)
        await payback(borrower, parseEther('825'))
        await loanToken.close()
        await loanToken.redeem(parseEther('1100'))
      })

      it('transfers all trueCurrency tokens to lender', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('825'))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await loanToken.repaid()).to.equal(parseEther('825'))
      })
    })

    describe('loan defaulted (1/2 paid back), redeem half, then rest is paid back, redeem rest', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, monthInSeconds * 12)
        await withdraw(borrower)
        await payback(borrower, parseEther('550'))
        await loanToken.close()
        await loanToken.redeem(parseEther('550'))
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('275'))
        await payback(borrower, parseEther('550'))
        await loanToken.redeem(parseEther('550'))
      })

      it('transfers all trueCurrency tokens to lender', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('1100'))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid is total paid back amount', async () => {
        expect(await loanToken.repaid()).to.equal(parseEther('1100'))
      })

      it('status is still DEFAULTED', async () => {
        expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
      })
    })

    describe('loan defaulted (1/2 paid back), redeem part, then rest is paid back, redeem rest - many LOAN hodlers', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await loanToken.transfer(other.address, parseEther('550'))
        await timeTravel(provider, monthInSeconds * 12)
        await withdraw(borrower)
        await payback(borrower, parseEther('550'))
        await loanToken.close()
        await loanToken.redeem(parseEther('275'))
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('275').div(2))
        await payback(borrower, parseEther('550'))
        await loanToken.redeem(parseEther('275'))
        await loanToken.connect(other).redeem(parseEther('550'))
      })

      it('transfers all trueCurrency tokens to LOAN holders', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEther('275').div(2).add(parseEther('1100').mul(7).div(24)))
        expect(await tusd.balanceOf(other.address)).to.equal(parseEther('1100').mul(7).div(12).add(1)) // 1 wei err
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid is total paid back amount', async () => {
        expect(await loanToken.repaid()).to.equal(parseEther('1100'))
      })

      it('status is still DEFAULTED', async () => {
        expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
      })
    })
  })

  describe('Debt calculation', () => {
    const getDebt = async (amount: number, termInMonths: number, apy: number) => {
      const contract = await new LoanTokenFactory(borrower).deploy(tusd.address, borrower.address, parseEther(amount.toString()), termInMonths * monthInSeconds, apy)
      return Number.parseInt(formatEther(await contract.debt()))
    }

    it('1 year, 10%', async () => {
      expect(await getDebt(1000, 12, 1000)).to.equal(1100)
    })

    it('1 year, 25%', async () => {
      expect(await getDebt(1000, 12, 2500)).to.equal(1250)
    })

    it('0.5 year, 10%', async () => {
      expect(await getDebt(1000, 6, 1000)).to.equal(1050)
    })

    it('3 years, 8%', async () => {
      expect(await getDebt(1000, 36, 800)).to.equal(1240)
    })

    it('2.5 years, 12%', async () => {
      expect(await getDebt(1000, 30, 1200)).to.equal(1300)
    })
  })
})
