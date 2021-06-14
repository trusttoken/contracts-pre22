import { expect } from 'chai'
import { beforeEachWithFixture, createApprovedLoan, DAY, parseEth, setupTruefi2, timeTravel as _timeTravel } from 'utils'
import { Wallet } from 'ethers'

import {
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
  let tru: MockTrueCurrency
  let stkTru: StkTruToken

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365

  const defaultAmount = parseEth(1100)

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, borrower, voter] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ;({ safu, feeToken: token, pool, lender, loanFactory, tru, stkTru, rater } = await setupTruefi2(owner))

    loan = await createApprovedLoan(rater, tru, stkTru, loanFactory, borrower, pool, parseEth(1000), YEAR, 1000, voter, _provider)

    await token.mint(safu.address, defaultAmount)
    await token.mint(owner.address, parseEth(1e7))
    await token.approve(pool.address, parseEth(1e7))
    await pool.connect(owner).join(parseEth(1e7))
    await lender.connect(borrower).fund(loan.address)
  })

  it('transfers total loan amount to the pool', async () => {
    await timeTravel(DAY * 400)
    await loan.enterDefault()
    await safu.liquidate(loan.address)
    expect(await token.balanceOf(safu.address)).to.equal(0)
  })

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

  it('fails if loan is not defaulted', async () => {
    await expect(safu.liquidate(loan.address)).to.be.revertedWith('SAFU: Loan is not defaulted')
  })

  it('fails if loan is not created by factory', async () => {
    const strangerLoan = await new LoanToken2__factory(owner).deploy(pool.address, owner.address, owner.address, owner.address, 1000, 1, 1)
    await expect(safu.liquidate(strangerLoan.address)).to.be.revertedWith('SAFU: Unknown loan')
  })

  describe('redeem', () => {
    beforeEach(async () => {
      await timeTravel(DAY * 400)
      await loan.connect(borrower).withdraw(borrower.address)
      await loan.enterDefault()
    })

    it('only manager can call it', async () => {
      await safu.liquidate(loan.address)
      await expect(safu.connect(borrower).redeem(loan.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('burns loan tokens', async () => {
      await safu.liquidate(loan.address)
      await expect(() => safu.redeem(loan.address)).changeTokenBalance(loan, safu, parseEth(1100).mul(-1))
    })

    it('redeems available tokens', async () => {
      await safu.liquidate(loan.address)
      await token.mint(loan.address, parseEth(25))
      await expect(() => safu.redeem(loan.address)).changeTokenBalance(token, safu, parseEth(25))
    })

    it('emits a proper event', async () => {
      await safu.liquidate(loan.address)
      await token.mint(loan.address, parseEth(25))

      const loanTokensToBurn = await loan.balanceOf(safu.address)
      const currencyTokensToRedeem = await token.balanceOf(loan.address)

      await expect(safu.redeem(loan.address))
        .to.emit(safu, 'Redeemed')
        .withArgs(loanTokensToBurn, currencyTokensToRedeem)
    })
  })
})
