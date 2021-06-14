import { expect } from 'chai'
import { beforeEachWithFixture, createApprovedLoan, DAY, parseEth, parseTRU, setupTruefi2, timeTravel as _timeTravel } from 'utils'
import { Wallet } from 'ethers'

import {
  Liquidator2,
  LoanFactory2,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  Safu,
  StkTruToken,
  TrueFiPool2,
  TrueLender2,
  TrueRatingAgencyV2,
} from 'contracts'

describe('SAFU', () => {
  let owner: Wallet, borrower: Wallet, voter: Wallet

  let safu: Safu
  let token: MockTrueCurrency
  let loan: LoanToken2
  let loanFactory: LoanFactory2
  let pool: TrueFiPool2
  let lender: TrueLender2
  let rater: TrueRatingAgencyV2
  let liquidator: Liquidator2
  let tru: MockTrueCurrency
  let stkTru: StkTruToken

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + DAY

  const defaultAmount = parseEth(1100)

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, borrower, voter] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ;({ safu, feeToken: token, pool, lender, loanFactory, tru, stkTru, rater, liquidator } = await setupTruefi2(owner))

    loan = await createApprovedLoan(rater, tru, stkTru, loanFactory, borrower, pool, parseEth(1000), YEAR, 1000, voter, _provider)

    await token.mint(safu.address, defaultAmount)
    await token.mint(owner.address, parseEth(1e7))
    await token.approve(pool.address, parseEth(1e7))
    await pool.connect(owner).join(parseEth(1e7))
    await lender.connect(borrower).fund(loan.address)
    await loan.connect(borrower).withdraw(borrower.address)

    await tru.mint(owner.address, parseTRU(1e7))
    await tru.approve(stkTru.address, parseTRU(1e7))

    await liquidator.setTokenApproval(token.address, true)
  })

  describe('initializer', () => {
    it('sets loan factory', async () => {
      expect(await safu.loanFactory()).to.eq(loanFactory.address)
    })

    it('sets liquidator', async () => {
      expect(await safu.liquidator()).to.eq(liquidator.address)
    })
  })

  describe('liquidate', () => {
    describe('reverts if', () => {
      it('loan is not defaulted', async () => {
        await expect(safu.liquidate(loan.address)).to.be.revertedWith('SAFU: Loan is not defaulted')
      })

      it('loan is not created by factory', async () => {
        const strangerLoan = await new LoanToken2__factory(owner).deploy(pool.address, owner.address, owner.address, owner.address, 1000, 1, 1)
        await expect(safu.liquidate(strangerLoan.address)).to.be.revertedWith('SAFU: Unknown loan')
      })
    })

    describe('handles loan tokens', () => {
      it('transfers LoanTokens to the SAFU', async () => {
        await timeTravel(DAY * 400)
        await loan.enterDefault()
        await safu.liquidate(loan.address)
        await expect(await loan.balanceOf(safu.address)).to.equal(defaultAmount)
      })

      it('transfers LoanTokens that were partially taken from pool', async () => {
        await pool.exit(parseEth(1e6))
        await timeTravel(DAY * 400)
        await loan.enterDefault()
        await safu.liquidate(loan.address)
        await expect(await loan.balanceOf(safu.address)).to.equal(defaultAmount.mul(9).div(10))
      })
    })

    describe('slashes tru', () => {
      beforeEach(async () => {
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
      })

      describe('loan not repaid at all', () => {
        it('0 tru in staking pool balance', async () => {
          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.eq(0)
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(1e2))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(4400))
        })
      })

      describe('half of loan repaid', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseEth(550))
        })

        it('0 tru in staking pool balance', async () => {
          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await safu.liquidate(loan.address)
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(22e2))
        })
      })
    })

    it('transfers total loan amount to the pool', async () => {
      await timeTravel(DAY * 400)
      await loan.enterDefault()
      await safu.liquidate(loan.address)
      expect(await token.balanceOf(safu.address)).to.equal(0)
    })
  })
})
