import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth, setupTruefi2 } from 'utils'

import { DebtToken, DebtToken__factory, MockTrueCurrency, MockTrueCurrency__factory } from 'contracts'

use(solidity)

describe('DebtToken', () => {
  enum LoanTokenStatus {
    Defaulted = 4,
    Liquidated
  }

  const payback = async (wallet: Wallet, amount: BigNumberish) => token.mint(debtToken.address, amount)
  const debt = parseEth(1)

  let lender: Wallet
  let borrower: Wallet
  let safu: Wallet
  let debtToken: DebtToken
  let token: MockTrueCurrency
  let poolAddress: string
  let provider: MockProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    [lender, borrower, safu] = wallets
    provider = _provider

    const { standardPool } = await setupTruefi2(lender, provider)
    poolAddress = standardPool.address
    token = MockTrueCurrency__factory.connect(await standardPool.token(), lender)
    debtToken = await new DebtToken__factory(lender).deploy()
    await debtToken.initialize(standardPool.address, lender.address, borrower.address, safu.address, debt)
  })

  describe('Constructor', () => {
    it('correctly takes token from pool', async () => {
      expect(await debtToken.token()).to.equal(token.address)
    })

    it('sets pool address', async () => {
      expect(await debtToken.pool()).to.equal(poolAddress)
    })

    it('sets borrowers debt', async () => {
      expect(await debtToken.debt()).to.equal(debt)
    })

    it('sets erc20 params', async () => {
      expect(await debtToken.name()).to.equal('TrueFi Debt Token')
      expect(await debtToken.symbol()).to.equal('DEBT')
      expect(await debtToken.decimals()).to.equal(18)
    })

    it('mints tokens for the lender', async () => {
      expect(await debtToken.balanceOf(lender.address)).to.equal(debt)
      expect(await debtToken.totalSupply()).to.equal(debt)
    })

    it('sets status to Defaulted', async () => {
      expect(await debtToken.status()).to.equal(LoanTokenStatus.Defaulted)
    })
  })

  describe('liquidate', () => {
    it('reverts if liquidated twice', async () => {
      await debtToken.connect(safu).liquidate()
      await expect(debtToken.connect(safu).liquidate())
        .to.be.revertedWith('DebtToken: Current status should be Defaulted')
    })

    it('reverts if not called by liquidator', async () => {
      await expect(debtToken.liquidate())
        .to.be.revertedWith('DebtToken: Caller is not the liquidator')
    })

    it('sets status to liquidated', async () => {
      await debtToken.connect(safu).liquidate()
      expect(await debtToken.status()).to.equal(LoanTokenStatus.Liquidated)
    })
  })

  describe('Redeem', () => {
    beforeEach(async () => {
      await token.mint(borrower.address, parseEth(100))
    })

    it('reverts if redeeming more than own balance', async () => {
      await payback(borrower, parseEth(100))
      await expect(debtToken.redeem(debt.add(1))).to.be.revertedWith('ERC20: burn amount exceeds balance')
    })

    it('emits event', async () => {
      await payback(borrower, parseEth(100))
      await expect(debtToken.redeem(debt)).to.emit(debtToken, 'Redeemed').withArgs(lender.address, debt, parseEth(100))
    })

    describe('Simple case: whole debt paid back, redeem all', () => {
      beforeEach(async () => {
        await payback(borrower, debt)
        await expect(() => debtToken.redeem(debt)).to.changeTokenBalance(token, lender, debt)
      })

      it('burns loan tokens', async () => {
        expect(await debtToken.totalSupply()).to.equal(0)
        expect(await debtToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await debtToken.repaid()).to.equal(debt)
      })
    })

    describe('3/4 paid back, redeem all', () => {
      const repaid = debt.mul(3).div(4)

      beforeEach(async () => {
        await payback(borrower, repaid)
        await expect(() => debtToken.redeem(debt)).to.changeTokenBalance(token, lender, repaid)
      })

      it('burns debt tokens', async () => {
        expect(await debtToken.totalSupply()).to.equal(0)
        expect(await debtToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid amount does not change', async () => {
        expect(await debtToken.repaid()).to.equal(repaid)
      })
    })

    describe('1/2 paid back redeem half, then rest is paid back, redeem rest', () => {
      beforeEach(async () => {
        await payback(borrower, debt.div(2))
        await debtToken.redeem(debt.div(2))
        expect(await token.balanceOf(lender.address)).to.equal(debt.div(4))
        await payback(borrower, debt.div(2))
        await debtToken.redeem(debt.div(2))
      })

      it('transfers all tokens to the lender', async () => {
        expect(await token.balanceOf(lender.address)).to.equal(debt)
      })

      it('burns loan tokens', async () => {
        expect(await debtToken.totalSupply()).to.equal(0)
        expect(await debtToken.balanceOf(lender.address)).to.equal(0)
      })

      it('repaid is total paid back amount', async () => {
        expect(await debtToken.repaid()).to.equal(debt)
      })

      it('status is still DEFAULTED', async () => {
        expect(await debtToken.status()).to.equal(LoanTokenStatus.Defaulted)
      })
    })
  })

  it('version', async () => {
    expect(await debtToken.version()).to.equal(1)
  })
})
