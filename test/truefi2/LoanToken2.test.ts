import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, BigNumberish, ContractTransaction, Wallet } from 'ethers'

import { beforeEachWithFixture, expectScaledCloseTo, parseEth, timeTravel } from 'utils'

import {
  ImplementationReference__factory,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  MockTrueCurrency__factory,
  PoolFactory__factory,
  TrueFiPool2__factory,
} from 'contracts'
import { deployContract } from 'scripts/utils/deployContract'
import { AddressZero } from '@ethersproject/constants'
import { formatEther } from '@ethersproject/units'

use(solidity)

describe('LoanToken2', () => {
  enum LoanTokenStatus {
    Awaiting, Funded, Withdrawn, Settled, Defaulted,
    Liquidated
  }

  const dayInSeconds = 60 * 60 * 24
  const yearInSeconds = dayInSeconds * 365
  const averageMonthInSeconds = yearInSeconds / 12
  const defaultedLoanCloseTime = yearInSeconds + dayInSeconds

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loanToken.connect(wallet).withdraw(beneficiary)

  const payback = async (wallet: Wallet, amount: BigNumberish) => token.mint(loanToken.address, amount)

  let lender: Wallet
  let borrower: Wallet
  let other: Wallet
  let loanToken: LoanToken2
  let token: MockTrueCurrency
  let poolAddress: string
  let provider: MockProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    [lender, borrower, other] = wallets
    provider = _provider

    token = await new MockTrueCurrency__factory(lender).deploy()
    await token.initialize()
    await token.mint(lender.address, parseEth(1000))

    const poolFactory = await deployContract(lender, PoolFactory__factory)
    const poolImplementation = await deployContract(lender, TrueFiPool2__factory)
    const implementationReference = await deployContract(lender, ImplementationReference__factory, [poolImplementation.address])
    await poolFactory.initialize(implementationReference.address, AddressZero, AddressZero)
    await poolFactory.whitelist(token.address, true)
    await poolFactory.createPool(token.address)
    poolAddress = await poolFactory.pool(token.address)

    loanToken = await new LoanToken2__factory(lender).deploy(
      poolAddress,
      borrower.address,
      lender.address,
      lender.address, // easier testing purposes
      parseEth(1000),
      yearInSeconds,
      1000,
    )
    await token.approve(loanToken.address, parseEth(1000))
  })

  describe('Constructor', () => {
    it('correctly takes token from pool', async () => {
      expect(await loanToken.token()).to.equal(token.address)
    })

    it('sets pool address', async () => {
      expect(await loanToken.pool()).to.equal(poolAddress)
    })

    it('sets loan params', async () => {
      expect(await loanToken.borrower()).to.equal(borrower.address)
      expect(await loanToken.amount()).to.equal(parseEth(1000))
      expect(await loanToken.term()).to.equal(yearInSeconds)
      expect(await loanToken.apy()).to.equal(1000)
      expect(await loanToken.start()).to.be.equal(0)
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Awaiting)
    })

    it('sets borrowers debt', async () => {
      expect(await loanToken.debt()).to.equal(parseEth(1100))
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
      expect(await token.balanceOf(loanToken.address)).to.equal(parseEth(1000))
    })

    it('reverts when funding the same loan token twice', async () => {
      await expect(loanToken.fund())
        .to.be.revertedWith('LoanToken2: Current status should be Awaiting')
    })

    it('emits event', async () => {
      await expect(Promise.resolve(tx)).to.emit(loanToken, 'Funded').withArgs(lender.address)
    })

    it('reverts if not called by lender', async () => {
      await expect(loanToken.connect(borrower).fund())
        .to.be.revertedWith('LoanToken2: Current status should be Awaiting')
    })
  })

  describe('Withdraw', () => {
    it('borrower can take funds from loan token', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await token.balanceOf(borrower.address)).to.equal(await loanToken.amount())
    })

    it('transfers funds to beneficiary', async () => {
      await loanToken.fund()
      const randomAddress = Wallet.createRandom().address
      await withdraw(borrower, randomAddress)
      expect(await token.balanceOf(randomAddress)).to.equal(await loanToken.amount())
    })

    it('sets status to Withdrawn', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Withdrawn)
    })

    it('reverts if trying to withdraw twice', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken2: Current status should be Funded')
    })

    it('reverts when withdrawing from not funded loan', async () => {
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken2: Current status should be Funded')
    })

    it('reverts when withdrawing from closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      await expect(withdraw(borrower)).to.be.revertedWith('LoanToken2: Current status should be Funded')
    })

    it('reverts when sender is not a borrower', async () => {
      await loanToken.fund()
      await expect(withdraw(lender)).to.be.revertedWith('LoanToken2: Caller is not the borrower')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await expect(withdraw(borrower)).to.emit(loanToken, 'Withdrawn').withArgs(borrower.address)
    })
  })

  describe('Settle', () => {
    it('sets status to Settled if whole debt has been returned after term has passed', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, yearInSeconds)
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('sets status to Settled if whole debt has been returned before term has passed', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('loan can be payed back 1 day after term has ended', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, yearInSeconds + dayInSeconds / 2)
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan cannot be defaulted yet')
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Settled)
    })

    it('reverts when closing not funded loan', async () => {
      await expect(loanToken.settle()).to.be.revertedWith('LoanToken2: Current status should be Funded or Withdrawn')
    })
  })

  describe('Enter Default', () => {
    it('sets status to Defaulted if no debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('sets status to Defaulted if not whole debt has been returned', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await token.mint(loanToken.address, parseEth(1099))
      await loanToken.enterDefault()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })

    it('reverts when closing right after funding', async () => {
      await loanToken.fund()
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan cannot be defaulted yet')
    })

    it('reverts when closing ongoing loan', async () => {
      await loanToken.fund()
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan cannot be defaulted yet')
      await timeTravel(provider, yearInSeconds - 10)
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Loan cannot be defaulted yet')
    })

    it('reverts when trying to close already closed loan', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      await expect(loanToken.enterDefault()).to.be.revertedWith('LoanToken2: Current status should be Funded or Withdrawn')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.mint(loanToken.address, parseEth(1099))
      await timeTravel(provider, defaultedLoanCloseTime)
      await expect(loanToken.enterDefault()).to.emit(loanToken, 'Defaulted').withArgs(parseEth(1099))
    })
  })

  describe('liquidate', () => {
    it('reverts when status is not defaulted', async () => {
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken2: Current status should be Defaulted')

      await loanToken.fund()
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken2: Current status should be Defaulted')

      await withdraw(borrower)
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken2: Current status should be Defaulted')

      await timeTravel(provider, defaultedLoanCloseTime)
      await expect(loanToken.liquidate())
        .to.be.revertedWith('LoanToken2: Current status should be Defaulted')
    })

    it('reverts if not called by liquidator', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()

      await expect(loanToken.connect(borrower).liquidate())
        .to.be.revertedWith('LoanToken2: Caller is not the liquidator')
    })

    it('sets status to liquidated', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()

      await loanToken.liquidate()
      expect(await loanToken.status()).to.equal(LoanTokenStatus.Liquidated)
    })
  })

  describe('Repay', () => {
    it('reverts if called before withdraw', async () => {
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken2: Only after loan has been withdrawn')
      await loanToken.fund()
      await expect(loanToken.repay(lender.address, 1)).to.be.revertedWith('LoanToken2: Only after loan has been withdrawn')
    })

    it('transfers trueCurrencies to loanToken', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await loanToken.repay(borrower.address, parseEth(100))

      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(1000).sub(parseEth(100)))
      expect(await token.balanceOf(loanToken.address)).to.equal(parseEth(100))
    })

    it('reverts if borrower tries to repay more than remaining debt', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.mint(borrower.address, parseEth(300))
      await token.connect(borrower).approve(loanToken.address, parseEth(1200))

      await expect(loanToken.repay(borrower.address, parseEth(1200)))
        .to.be.revertedWith('LoanToken2: Cannot repay over the debt')

      await loanToken.repay(borrower.address, parseEth(500))

      await expect(loanToken.repay(borrower.address, parseEth(1000)))
        .to.be.revertedWith('LoanToken2: Cannot repay over the debt')
    })

    it('emits proper event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await expect(loanToken.repay(borrower.address, parseEth(100)))
        .to.emit(loanToken, 'Repaid')
        .withArgs(borrower.address, parseEth(100))
    })
  })

  describe('Repay in full', () => {
    it('reverts if called before withdraw', async () => {
      await expect(loanToken.repayInFull(lender.address)).to.be.revertedWith('LoanToken2: Only after loan has been withdrawn')
      await loanToken.fund()
      await expect(loanToken.repayInFull(lender.address)).to.be.revertedWith('LoanToken2: Only after loan has been withdrawn')
    })

    it('transfers trueCurrencies to loanToken', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await loanToken.repayInFull(borrower.address)

      expect(await token.balanceOf(borrower.address)).to.equal(parseEth(1000).add(parseEth(300)).sub(debt))
      expect(await token.balanceOf(loanToken.address)).to.equal(debt)
    })

    it('emits Repaid event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await expect(loanToken.repayInFull(borrower.address))
        .to.emit(loanToken, 'Repaid')
        .withArgs(borrower.address, debt)
    })

    it('emits Settled event', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await expect(loanToken.repayInFull(borrower.address))
        .to.emit(loanToken, 'Settled')
        .withArgs(debt)
    })
  })

  describe('Redeem', () => {
    beforeEach(async () => {
      await token.mint(borrower.address, parseEth(100))
    })

    it('reverts if called before loan is closed', async () => {
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken2: Only after loan has been closed')
      await loanToken.fund()
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken2: Only after loan has been closed')
      await withdraw(borrower)
      await expect(loanToken.redeem(1)).to.be.revertedWith('LoanToken2: Only after loan has been closed')
    })

    it('reverts if redeeming more than own balance', async () => {
      await loanToken.fund()
      await timeTravel(provider, yearInSeconds)
      await payback(borrower, parseEth(100))
      await expect(loanToken.redeem(parseEth(1100))).to.be.revertedWith('LoanToken2: Only after loan has been closed')
    })

    it('emits event', async () => {
      await loanToken.fund()
      await timeTravel(provider, defaultedLoanCloseTime)
      await loanToken.enterDefault()
      await expect(loanToken.redeem(parseEth(1100))).to.emit(loanToken, 'Redeemed').withArgs(lender.address, parseEth(1100), parseEth(1000))
    })

    describe('Simple case: loan settled, redeem all', () => {
      beforeEach(async () => {
        await loanToken.fund()
        await timeTravel(provider, yearInSeconds)
        await payback(borrower, await parseEth(100))
        await loanToken.settle()
        await expect(() => loanToken.redeem(parseEth(1100))).to.changeTokenBalance(token, lender, parseEth(1100))
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
        await loanToken.enterDefault()
        await expect(() => loanToken.redeem(parseEth(1100))).to.changeTokenBalance(token, lender, parseEth(825))
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
        await loanToken.enterDefault()
        await loanToken.redeem(parseEth(550))
        expect(await token.balanceOf(lender.address)).to.equal(await parseEth(275))
        await payback(borrower, parseEth(550))
        await loanToken.redeem(parseEth(550))
      })

      it('transfers all trueCurrency tokens to lender', async () => {
        expect(await token.balanceOf(lender.address)).to.equal(await parseEth(1100))
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
        await token.transfer(Wallet.createRandom().address, await token.balanceOf(lender.address))
        await loanToken.transfer(other.address, parseEth(550))
        await timeTravel(provider, defaultedLoanCloseTime)
        await withdraw(borrower)
        await payback(borrower, parseEth(550))
        await loanToken.enterDefault()
        await loanToken.redeem(parseEth(275))
        expect(await token.balanceOf(lender.address)).to.equal(parseEth(275).div(2))
        await payback(borrower, parseEth(550))
        await loanToken.redeem(parseEth(275))
        await loanToken.connect(other).redeem(parseEth(550))
      })

      it('transfers all trueCurrency tokens to LOAN holders', async () => {
        expect(await token.balanceOf(lender.address)).to.equal(parseEth(275).div(2).add(parseEth(1100).mul(7).div(24)))
        expect(await token.balanceOf(other.address)).to.equal(parseEth(1100).mul(7).div(12).add(1)) // 1 wei err
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
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
    })

    const paybackRedeemPayback = async () => {
      await payback(borrower, parseEth(900))
      await loanToken.redeem(parseEth(1100))
      await payback(borrower, parseEth(200))
    }

    it('reverts when loan not closed', async () => {
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken2: Only after loan has been closed')
    })

    it('reverts when not borrower tries access', async () => {
      await loanToken.enterDefault()
      await expect(loanToken.reclaim())
        .to.be.revertedWith('LoanToken2: Caller is not the borrower')
    })

    it('reverts when total supply is greater than 0', async () => {
      await loanToken.enterDefault()
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken2: Cannot reclaim when LoanTokens are in circulation')
    })

    it('reverts when balance is 0', async () => {
      await loanToken.enterDefault()
      await payback(borrower, parseEth(1100))
      await loanToken.redeem(parseEth(1100))
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken2: Cannot reclaim when balance 0')
    })

    it('reclaims surplus when conditions met', async () => {
      await loanToken.enterDefault()
      await paybackRedeemPayback()
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(token, borrower, parseEth(200))
    })

    it('reverts when reclaims twice', async () => {
      await loanToken.enterDefault()
      await paybackRedeemPayback()
      await loanToken.connect(borrower).reclaim()
      await expect(loanToken.connect(borrower).reclaim())
        .to.be.revertedWith('LoanToken2: Cannot reclaim when balance 0')
    })

    it('reclaims, pays some more and reclaims again', async () => {
      await loanToken.enterDefault()
      await payback(borrower, parseEth(900))
      await loanToken.redeem(parseEth(1100))
      await payback(borrower, parseEth(100))
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(token, borrower, parseEth(100))
      await payback(borrower, parseEth(100))
      await expect(() => loanToken.connect(borrower).reclaim())
        .to.changeTokenBalance(token, borrower, parseEth(100))
    })

    it('emits event', async () => {
      await loanToken.enterDefault()
      await paybackRedeemPayback()
      await expect(loanToken.connect(borrower).reclaim()).to.emit(loanToken, 'Reclaimed')
        .withArgs(borrower.address, parseEth(200))
    })
  })

  describe('Whitelisting', () => {
    it('reverts when not whitelisted before funding', async () => {
      await expect(loanToken.connect(other).allowTransfer(other.address, true)).to.be.revertedWith('LoanToken2: This can be performed only by lender')
    })

    it('reverts when not whitelisted not by a lender', async () => {
      await loanToken.fund()
      await expect(loanToken.connect(other).allowTransfer(other.address, true)).to.be.revertedWith('LoanToken2: This can be performed only by lender')
    })

    it('non-whitelisted address cannot transfer', async () => {
      await loanToken.fund()
      await loanToken.transfer(other.address, 10)
      await expect(loanToken.connect(other).transfer(lender.address, 2)).to.be.revertedWith('LoanToken2: This can be performed only by lender or accounts allowed to transfer')
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
      const contract = await new LoanToken2__factory(borrower).deploy(poolAddress, borrower.address, lender.address, lender.address, parseEth(amount.toString()), termInMonths * averageMonthInSeconds, apy)
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

  describe('Is repaid?', () => {
    it('reverts if called before funding', async () => {
      await expect(loanToken.isRepaid()).to.be.revertedWith('LoanToken2: Current status should be Funded or Withdrawn')
    })

    it('reverts if called after settling', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      const debt = await loanToken.debt()
      await token.connect(borrower).approve(loanToken.address, debt)
      await token.mint(borrower.address, parseEth(300))
      await loanToken.repayInFull(borrower.address)
      await expect(loanToken.isRepaid()).to.be.revertedWith('LoanToken2: Current status should be Funded or Withdrawn')
    })

    it('returns false before full repayment', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.connect(borrower).approve(loanToken.address, parseEth(100))
      await loanToken.repay(borrower.address, parseEth(100))

      expect(await loanToken.isRepaid()).to.be.false
    })

    it('returns true after transfer repayment', async () => {
      await loanToken.fund()
      await withdraw(borrower)
      await token.connect(borrower).approve(loanToken.address, parseEth(900))
      await loanToken.repay(borrower.address, parseEth(900))
      await token.mint(loanToken.address, parseEth(300))

      expect(await loanToken.isRepaid()).to.be.true
    })
  })

  describe('Value', () => {
    let loanTokenBalance: BigNumber

    beforeEach(async () => {
      await loanToken.fund()
      loanTokenBalance = await loanToken.balanceOf(lender.address)
    })

    it('beginning of the loan', async () => {
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1000))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1000).div(2))
    })

    it('middle of the loan', async () => {
      await timeTravel(provider, averageMonthInSeconds * 6)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1050))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1050).div(2))
      await timeTravel(provider, averageMonthInSeconds * 3)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1075))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1075).div(2))
    })

    it('end of the loan', async () => {
      await timeTravel(provider, yearInSeconds)
      expectScaledCloseTo(await loanToken.value(loanTokenBalance), parseEth(1100))
      expectScaledCloseTo(await loanToken.value(loanTokenBalance.div(2)), parseEth(1100).div(2))
    })

    it('loan fully repaid and closed before term', async () => {
      await token.mint(loanToken.address, parseEth(1100))
      await loanToken.settle()
      expect(await loanToken.value(loanTokenBalance)).to.be.equal(parseEth(1100))
    })
  })

  it('version', async () => {
    expect(await loanToken.version()).to.equal(4)
  })
})
