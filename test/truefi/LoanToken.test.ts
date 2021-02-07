import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { BigNumber, ContractTransaction, Wallet, BigNumberish } from 'ethers'
import { formatEther } from '@ethersproject/units'

import {
  beforeEachWithFixture,
  timeTravel,
  expectScaledCloseTo,
  parseEth,
} from 'utils'

import {
  LoanToken,
  LoanTokenFactory,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
} from 'contracts'

describe('LoanToken', () => {
  enum LoanTokenStatus {
    Awaiting, Funded, Withdrawn, Settled, Defaulted,
    Liquidated
  }

  let provider: MockProvider
  let lender: Wallet
  let borrower: Wallet
  let other: Wallet
  let loanToken: LoanToken
  let tusd: MockTrueCurrency

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12
  const defaultedLoanCloseTime = yearInSeconds + dayInSeconds

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loanToken.connect(wallet).withdraw(beneficiary)

  const payback = async (wallet: Wallet, amount: BigNumberish) => tusd.mint(loanToken.address, amount)

  const removeFee = (amount: BigNumber) => amount.mul(9975).div(10000)
  const addFee = async (amount: BigNumber) => amount.add((await loanToken.amount()).mul(25).div(10000))

  beforeEachWithFixture(async (wallets, _provider) => {
    [lender, borrower, other] = wallets
    provider = _provider

    tusd = await new MockTrueCurrencyFactory(lender).deploy()
    await tusd.initialize()
    await tusd.mint(lender.address, parseEth(1000))

    loanToken = await new LoanTokenFactory(lender).deploy(
      tusd.address,
      borrower.address,
      lender.address,
      lender.address, // easier testing purposes
      parseEth(1000),
      yearInSeconds,
      1000,
    )

    await tusd.approve(loanToken.address, parseEth(1000))
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
      expect(await loanToken.amount()).to.equal(parseEth(1000))
      expect(await loanToken.term()).to.equal(yearInSeconds)
      expect(await loanToken.apy()).to.equal(1000)
      expect(await loanToken.start()).to.be.equal(0)
      expect(await loanToken.isLoanToken()).to.be.true
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Awaiting)
    })

    it('sets borrowers debt', async () => {
      expect(await loanToken.debt()).to.equal(parseEth(1100))
    })

    it('received amount if total amount minus fee', async () => {
      expect(await loanToken.receivedAmount()).to.equal(parseEth(1000).mul(9975).div(10000))
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

    it('mints lenders loan tokens', async () => {
      expect(await loanToken.balanceOf(lender.address)).to.equal(parseEth(1100))
      expect(await loanToken.totalSupply()).to.equal(parseEth(1100))
    })

    it('transfers proper amount of currency token from lender to loanToken contact', async () => {
      expect(await tusd.balanceOf(loanToken.address)).to.equal(removeFee(parseEth(1000)))
    })

    it('reverts when funding the same loan token twice', async () => {
      await expect(loanToken.fund())
        .to.be.revertedWith('LoanToken: Current status should be Awaiting')
    })

    it('emits event', async () => {
      await expect(Promise.resolve(tx)).to.emit(loanToken, 'Funded').withArgs(lender.address)
    })

    it('reverts if not called by lender', async () => {
      await expect(loanToken.connect(borrower).fund())
        .to.be.revertedWith('LoanToken: Current status should be Awaiting')
    })
  })

  describe('Withdraw', () => {
    it('borrower can take funds from loan token', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await tusd.balanceOf(borrower.address)).to.equal(await loanToken.receivedAmount())
    })

    it('transfers funds to beneficiary', async () => {
      await loanToken.fund()
      const randomAddress = Wallet.createRandom().address
      await withdraw(borrower, randomAddress)
      expect(await tusd.balanceOf(randomAddress)).to.equal(await loanToken.receivedAmount())
    })

    it('sets status to Withdrawn', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Withdrawn)
    })

    it('reverts if trying to withdraw twice', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: Current status should be Funded')
    })

    it('reverts when withdrawing from not funded loan', async () => {
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: Current status should be Funded')
    })

    it('reverts when withdrawing from closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken: Current status should be Funded')
    })

    it('reverts when sender is not a borrower', async () => {
      await loanToken.fund()
      await expect(withdraw(lender)).to.be.revertedWith('LoanToken: Caller is not the borrower')
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
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Defaulted if not whole debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await tusd.mint(loanToken.address, parseEth(1099))
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Settled if whole debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, yearInSeconds)
      await tusd.mint(loanToken.address, parseEth(1100))
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('loan can be payed back 1 day after term has ended', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, yearInSeconds + dayInSeconds / 2)
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: Borrower can still pay the loan back')
      await tusd.mint(loanToken.address, parseEth(1100))
      await loanToken.close()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('reverts when closing not funded loan', async () => {
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: Current status should be Funded')
    })

    it('reverts when closing ongoing loan', async () => {
      await loanToken.fund()
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: Loan cannot be closed yet')
      await timeTravel(provider, yearInSeconds - 10)
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: Loan cannot be closed yet')
    })

    it('reverts when trying to close already closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()
      await expect(loanToken.close()).to.be.revertedWith('LoanToken: Current status should be Funded')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.mint(loanToken.address, parseEth(1099))
      await timeTravel(provider, defaultedLoanCloseTime)
      await expect(loanToken.close()).to.emit(loanToken, 'Closed').withArgs(LoanTokenStatus.Defaulted, parseEth(1099))
    })
  })

  describe('liquidate', () => {
    it('reverts when status is not defaulted', async () => {
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')

      await loanToken.fund()
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')

      await withdraw(borrower)
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')

      await timeTravel(provider, defaultedLoanCloseTime)
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken: Current status should be Defaulted')
    })

    it('reverts if not called by liquidator', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await expect(loanToken.connect(borrower).liquidate())
        .to.be.revertedWith('LoanToken: Caller is not the liquidator')
    })

    it('sets status to liquidated', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()

      await loanToken.liquidate()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Liquidated)
    })
  })

  describe('Repay', () => {
    it('reverts if called before withdraw', async () => {
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken: Only after loan has been withdrawn')
      await loanToken.fund()
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken: Only after loan has been withdrawn')
    })

    it('transfers trueCurrencies to loanToken', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.connect(borrower).approve(loanToken.address, parseEth(100))
      await loanToken.repay(borrower.address, parseEth(100))

      expect(await tusd.balanceOf(borrower.address)).to.equal(removeFee(parseEth(1000)).sub(parseEth(100)))
      expect(await tusd.balanceOf(loanToken.address)).to.equal(parseEth(100))
    })

    it('reverts if borrower tries to repay more than remaining debt', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.mint(borrower.address, parseEth(300))
      await tusd.connect(borrower).approve(loanToken.address, parseEth(1200))

      await expect(loanToken.repay(borrower.address, parseEth(1200)))
        .to.be.revertedWith('LoanToken: Cannot repay over the debt')

      await loanToken.repay(borrower.address, parseEth(500))

      await expect(loanToken.repay(borrower.address, parseEth(1000)))
        .to.be.revertedWith('LoanToken: Cannot repay over the debt')
    })

    it('emits proper event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await tusd.connect(borrower).approve(loanToken.address, parseEth(100))
      await expect(loanToken.repay(borrower.address, parseEth(100)))
        .to.emit(loanToken, 'Repaid')
        .withArgs(borrower.address, parseEth(100))
    })
  })

  describe('Redeem', () => {
    beforeEach(async () => {
      await tusd.mint(borrower.address, parseEth(100))
    })

    it('reverts if called before loan is closed', async () => {
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: Current status should be Settled or Defaulted')
      await loanToken.fund()
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: Current status should be Settled or Defaulted')
      await withdraw(borrower)
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken: Current status should be Settled or Defaulted')
    })

    it('reverts if redeeming more than own balance', async () => {
      await loanToken.fund()
      await timeTravel(provider, yearInSeconds)
      await payback(borrower, parseEth(100))
      await expect(loanToken.redeem(parseEth(1100))).to.be.revertedWith('LoanToken: Current status should be Settled or Defaulted')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.close()
      await expect(loanToken.redeem(parseEth(1100))).to.emit(loanToken, 'Redeemed').withArgs(lender.address, parseEth(1100), removeFee(parseEth(1000)))
    })

    describe('Simple case: loan settled, redeem all', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, yearInSeconds)
        await payback(borrower, await addFee(parseEth(100)))
        await loanToken.close()
        await expect(() => loanToken.redeem(parseEth(1100))).to.changeTokenBalance(tusd, lender, parseEth(1100))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await loanToken.repaid()).to.equal(parseEth(1100))
      })
    })

    describe('loan defaulted (3/4 paid back), redeem all', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, defaultedLoanCloseTime)
        await withdraw(borrower)
        await payback(borrower, parseEth(825))
        await loanToken.close()
        await expect(() => loanToken.redeem(parseEth(1100))).to.changeTokenBalance(tusd, lender, parseEth(825))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await loanToken.repaid()).to.equal(parseEth(825))
      })
    })

    describe('loan defaulted (1/2 paid back), redeem half, then rest is paid back, redeem rest', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, defaultedLoanCloseTime)
        await withdraw(borrower)
        await payback(borrower, parseEth(550))
        await loanToken.close()
        await loanToken.redeem(parseEth(550))
        expect(await tusd.balanceOf(lender.address)).to.equal(await addFee(parseEth(275)))
        await payback(borrower, parseEth(550))
        await loanToken.redeem(parseEth(550))
      })

      it('transfers all trueCurrency tokens to lender', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(await addFee(parseEth(1100)))
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid is total paid back amount', async () => {
        expect(await loanToken.repaid()).to.equal(parseEth(1100))
      })

      it('status is still DEFAULTED', async () => {
        expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
      })
    })

    describe('loan defaulted (1/2 paid back), redeem part, then rest is paid back, redeem rest - many LOAN holders', () => {
      beforeEach(async () => {
        await loanToken.fund()
        // burn excessive tokens
        await tusd.transfer(Wallet.createRandom().address, await tusd.balanceOf(lender.address))
        await loanToken.transfer(other.address, parseEth(550))
        await timeTravel(provider, defaultedLoanCloseTime)
        await withdraw(borrower)
        await payback(borrower, parseEth(550))
        await loanToken.close()
        await loanToken.redeem(parseEth(275))
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEth(275).div(2))
        await payback(borrower, parseEth(550))
        await loanToken.redeem(parseEth(275))
        await loanToken.connect(other).redeem(parseEth(550))
      })

      it('transfers all trueCurrency tokens to LOAN holders', async () => {
        expect(await tusd.balanceOf(lender.address)).to.equal(parseEth(275).div(2).add(parseEth(1100).mul(7).div(24)))
        expect(await tusd.balanceOf(other.address)).to.equal(parseEth(1100).mul(7).div(12).add(1)) // 1 wei err
      })

      it('burns loan tokens', async () => {
        expect(await loanToken.totalSupply()).to.equal(0)
        expect(await loanToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid is total paid back amount', async () => {
        expect(await loanToken.repaid()).to.equal(parseEth(1100))
      })

      it('status is still DEFAULTED', async () => {
        expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
      })
    })
  })

  describe('Reclaim', () => {
    beforeEach(async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await tusd.connect(borrower).approve(loanToken.address, parseEth(100))
    })

    const paybackRedeemPayback = async () => {
      await payback(borrower, parseEth(900))
      await loanToken.redeem(parseEth(1100))
      await payback(borrower, parseEth(200))
    }

    it('reverts when loan not closed', async () => {
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken: Current status should be Settled or Defaulted')
    })

    it('reverts when not borrower tries access', async () => {
      await loanToken.close()
      await expect(loanToken.reclaim())
        .to.be.revertedWith('LoanToken: Caller is not the borrower')
    })

    it('reverts when total supply is greater than 0', async () => {
      await loanToken.close()
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken: Cannot reclaim when LoanTokens are in circulation')
    })

    it('reverts when balance is 0', async () => {
      await loanToken.close()
      await payback(borrower, parseEth(1100))
      await loanToken.redeem(parseEth(1100))
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken: Cannot reclaim when balance 0')
    })

    it('reclaims surplus when conditions met', async () => {
      await loanToken.close()
      await paybackRedeemPayback()
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(tusd, borrower, parseEth(200))
    })

    it('reverts when reclaims twice', async () => {
      await loanToken.close()
      await paybackRedeemPayback()
      await loanToken.connect(borrower).reclaim()
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken: Cannot reclaim when balance 0')
    })

    it('reclaims, pays some more and reclaims again', async () => {
      await loanToken.close()
      await payback(borrower, parseEth(900))
      await loanToken.redeem(parseEth(1100))
      await payback(borrower, parseEth(100))
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(tusd, borrower, parseEth(100))
      await payback(borrower, parseEth(100))
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(tusd, borrower, parseEth(100))
    })

    it('emits event', async () => {
      await loanToken.close()
      await paybackRedeemPayback()
      await expect(loanToken.connect(borrower).reclaim()).to.emit(loanToken, 'Reclaimed')
        .withArgs(borrower.address, parseEth(200))
    })
  })

  describe('Whitelisting', () => {
    it('reverts when not whitelisted before funding', async () => {
      await expect(loanToken.connect(other).allowTransfer(other.address, true)).to.be.revertedWith('LoanToken: This can be performed only by lender')
    })

    it('reverts when not whitelisted not by a lender', async () => {
      await loanToken.fund()
      await expect(loanToken.connect(other).allowTransfer(other.address, true)).to.be.revertedWith('LoanToken: This can be performed only by lender')
    })

    it('non-whitelisted address cannot transfer', async () => {
      await loanToken.fund()
      await loanToken.transfer(other.address, 10)
      await expect(loanToken.connect(other).transfer(lender.address, 2)).to.be.revertedWith('LoanToken: This can be performed only by lender or accounts allowed to transfer')
    })

    it('whitelisted address can transfer', async () => {
      await loanToken.fund()
      await loanToken.transfer(other.address, 10)
      await loanToken.allowTransfer(other.address, true)
      await expect(loanToken.connect(other).transfer(lender.address, 2)).to.be.not.reverted
    })
  })

  describe('Debt calculation', () => {
    const getDebt = async (amount: number, termInMonths: number, apy: number) => {
      const contract = await new LoanTokenFactory(borrower).deploy(tusd.address, borrower.address, lender.address, lender.address, parseEth(amount.toString()), termInMonths * averageMonthInSeconds, apy)
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

  describe('Value', () => {
    let loanTokenBalance: BigNumber

    beforeEach(async () => {
      await loanToken.fund()
      loanTokenBalance = await loanToken.balanceOf(lender.address)
    })

    it('returns proper value at the beginning of the loan', async () => {
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1000))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1000).div(2))
    })

    it('returns proper value in the middle of the loan', async () => {
      await timeTravel(provider, averageMonthInSeconds * 6)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1050))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1050).div(2))
      await timeTravel(provider, averageMonthInSeconds * 3)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1075))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1075).div(2))
    })

    it('returns proper value at the end of the loan', async () => {
      await timeTravel(provider, yearInSeconds)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1100))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1100).div(2))
    })
  })
})
