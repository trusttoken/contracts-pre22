import { expect, use } from 'chai'
import {
  Liquidator2,
  LoanFactory2,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  StkTruToken,
  TrueFiPool2,
  TrueLender2,
  TrueRatingAgencyV2,
} from 'contracts'

import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { DAY } from 'utils/constants'
import { parseEth } from 'utils/parseEth'
import { parseTRU } from 'utils/parseTRU'
import { createApprovedLoan, timeTravel as _timeTravel, } from 'utils'
import { beforeEachWithFixture, setupTruefi2, createLoan } from 'utils'

const YEAR = DAY * 365
const defaultedLoanCloseTime = YEAR + DAY

use(solidity)

describe('Liquidator2', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let owner: Wallet
  let otherWallet: Wallet
  let borrower: Wallet
  let voter: Wallet

  let liquidator: Liquidator2
  let loanFactory: LoanFactory2
  let rater: TrueRatingAgencyV2
  let token: MockTrueCurrency
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let lender: TrueLender2
  let pool: TrueFiPool2
  let loan: LoanToken2

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + DAY

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loan.connect(wallet).withdraw(beneficiary)

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet, borrower, voter] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ;({liquidator, loanFactory, feeToken: token, tru, stkTru, lender, pool, rater} = await setupTruefi2(owner))

    loan = await createApprovedLoan(rater, tru, stkTru, loanFactory, borrower, pool, parseEth(1000), YEAR, 1000, voter, timeTravel)

    await token.mint(owner.address, parseEth(1e7))
    await token.approve(pool.address, parseEth(1e7))

    await tru.mint(owner.address, parseEth(1e7))
    await tru.mint(otherWallet.address, parseEth(15e6))
    await tru.approve(stkTru.address, parseEth(1e7))
    await tru.connect(otherWallet).approve(stkTru.address, parseEth(1e7))
  })

  describe('Initializer', () => {
    it('sets stkTru address correctly', async () => {
      expect(await liquidator.stkTru()).to.equal(stkTru.address)
    })

    it('sets tru address correctly', async () => {
      expect(await liquidator.tru()).to.equal(tru.address)
    })

    it('sets loanFactory address correctly', async () => {
      expect(await liquidator.loanFactory()).to.equal(loanFactory.address)
    })

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
    })
  })

  describe('fetchMaxShare', () => {
    it('only owner can set new share', async () => {
      await expect(liquidator.connect(otherWallet).setFetchMaxShare(500))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot set share to 0', async () => {
      await expect(liquidator.setFetchMaxShare(0))
        .to.be.revertedWith('Liquidator: Share cannot be set to 0')
    })

    it('cannot set share to number larger than 10000', async () => {
      await expect(liquidator.setFetchMaxShare(10001))
        .to.be.revertedWith('Liquidator: Share cannot be larger than 10000')
    })

    it('is changed properly', async () => {
      await liquidator.setFetchMaxShare(500)
      expect(await liquidator.fetchMaxShare()).to.equal(500)
    })

    it('emits event', async () => {
      await expect(liquidator.setFetchMaxShare(500))
        .to.emit(liquidator, 'FetchMaxShareChanged')
        .withArgs(500)
    })
  })

  describe('setTokenApproval', () => {
    it('only owner can set token approval', async () => {
      await expect(liquidator.connect(otherWallet).setTokenApproval(token.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes whitelist status', async () => {
      await liquidator.setTokenApproval(token.address, true)
      expect(await liquidator.approvedTokens(token.address)).to.eq(true)

      await liquidator.setTokenApproval(token.address, false)
      expect(await liquidator.approvedTokens(token.address)).to.eq(false)
    })

    it('emits event', async () => {
      await expect(liquidator.setTokenApproval(token.address, true))
        .to.emit(liquidator, 'WhitelistStatusChanged')
        .withArgs(token.address, true)

      await expect(liquidator.setTokenApproval(token.address, false))
        .to.emit(liquidator, 'WhitelistStatusChanged')
        .withArgs(token.address, false)
    })
  })

  describe('liquidate', () => {
    beforeEach(async () => {
      await pool.connect(owner).join(parseEth(1e7))
      await lender.connect(borrower).fund(loan.address)
      await withdraw(borrower)
      await liquidator.setTokenApproval(token.address, true)

    })

    it('anyone can call it', async () => {
      timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.connect(otherWallet).liquidate(loan.address))
        .to.not.be.reverted
    })

    describe('reverts if', () => {
      it('loan is not defaulted', async () => {
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')

        timeTravel(defaultedLoanCloseTime)
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')
      })

      it('loan was not created via factory', async () => {
        const deployContract = setupDeploy(owner)
        const fakeLoan = await deployContract(LoanToken2__factory, pool.address, borrower.address, borrower.address, liquidator.address, parseEth(1000), YEAR, 1000)
        await token.connect(borrower).approve(fakeLoan.address, parseEth(1000))
        await fakeLoan.connect(borrower).fund()
        timeTravel(defaultedLoanCloseTime)
        await fakeLoan.enterDefault()

        await expect(liquidator.liquidate(fakeLoan.address))
          .to.be.revertedWith('Liquidator: Unknown loan')
      })

      it('token is not whitelisted', async () => {
        await liquidator.setTokenApproval(token.address, false)
        timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
        await expect(liquidator.liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Token not approved for default protection')
      })
    })

    it('changes loanToken status', async () => {
      timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await liquidator.connect(otherWallet).liquidate(loan.address)
      expect(await loan.status()).to.equal(LoanTokenStatus.Liquidated)
    })

    describe('transfers correct amount of tru to trueFiPool', () => {
      beforeEach(async () => {
        timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
      })

      it('0 tru in staking pool balance', async () => {
        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
      })

      it('returns max fetch share to pool', async () => {
        await stkTru.stake(parseTRU(1e3))

        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(1e2))
      })

      it('returns defaulted value', async () => {
        await stkTru.stake(parseTRU(1e7))

        await liquidator.liquidate(loan.address)
        expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(4400))
      })

      describe('only half of loan value has defaulted', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseEth(550))
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })

      describe('half of loan has defaulted and half redeemed', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseEth(550))
          await lender.reclaim(loan.address, '0x')
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to pool', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.liquidate(loan.address)
          expect(await tru.balanceOf(pool.address)).to.equal(parseTRU(22e2))
        })
      })
    })

    it('emits event', async () => {
      await stkTru.stake(parseTRU(1e3))
      timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.liquidate(loan.address))
        .to.emit(liquidator, 'Liquidated')
        .withArgs(loan.address, parseEth(1100), parseTRU(100))
    })
  })
})
