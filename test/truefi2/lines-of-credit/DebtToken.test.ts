import { expect, use } from 'chai'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumberish, Wallet } from 'ethers'

import { beforeEachWithFixture, parseEth, setupTruefi2 } from 'utils'

import { DebtToken, DebtToken__factory, MockTrueCurrency, MockTrueCurrency__factory } from 'contracts'

use(solidity)

describe('DebtToken', () => {
  const payback = async (wallet: Wallet, amount: BigNumberish) => token.mint(debtToken.address, amount)
  const debt = parseEth(1000)

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

    it('sets borrower', async () => {
      expect(await debtToken.borrower()).to.equal(borrower.address)
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

    it('doesn\'t set isLiquidated', async () => {
      expect(await debtToken.isLiquidated()).to.be.false
    })
  })

  describe('liquidate', () => {
    it('reverts if liquidated twice', async () => {
      await debtToken.connect(safu).liquidate()
      await expect(debtToken.connect(safu).liquidate())
        .to.be.revertedWith('DebtToken: Debt must not be liquidated')
    })

    it('reverts if not called by liquidator', async () => {
      await expect(debtToken.liquidate())
        .to.be.revertedWith('DebtToken: Caller is not the liquidator')
    })

    it('sets isLiquidated', async () => {
      await debtToken.connect(safu).liquidate()
      expect(await debtToken.isLiquidated()).to.be.true
    })

    it('emits event', async () => {
      await expect(debtToken.connect(safu).liquidate()).to.emit(debtToken, 'Liquidated')
    })
  })

  describe('Redeem', () => {
    it('reverts if redeeming more than own balance', async () => {
      await payback(borrower, debt.add(1))
      await expect(debtToken.redeem(debt.add(1))).to.be.revertedWith('ERC20: burn amount exceeds balance')
    })

    it('reverts if trying to redeem more tokens than there were repaid', async () => {
      await payback(borrower, parseEth(99))
      await expect(debtToken.redeem(parseEth(100))).to.be.revertedWith('DebtToken: Insufficient repaid amount')
    })

    it('sends back same amount of tokens as were burnt', async () => {
      await payback(borrower, parseEth(100))
      await expect(() => debtToken.redeem(parseEth(100))).to.changeTokenBalances(
        token,
        [debtToken, lender],
        [parseEth(-100), parseEth(100)],
      )
    })

    describe('When debt has been overpaid', () => {
      beforeEach(async () => {
        await payback(borrower, debt.add(parseEth(1)))
      })

      it('when not the whole amount is redeemed, works normally', async () => {
        await expect(() => debtToken.redeem(parseEth(10))).to.changeTokenBalance(token, lender, parseEth(10))
      })

      it('when whole amount, sends whole balance to the sender', async () => {
        await expect(() => debtToken.redeem(debt)).to.changeTokenBalance(token, lender, debt.add(parseEth(1)))
      })
    })

    it('emits event', async () => {
      await payback(borrower, parseEth(100))
      await expect(debtToken.redeem(parseEth(100))).to.emit(debtToken, 'Redeemed').withArgs(lender.address, parseEth(100), parseEth(100))
    })
  })

  it('version', async () => {
    expect(await debtToken.version()).to.equal(1)
  })

  it('balance', async () => {
    expect(await debtToken.balance()).to.eq(parseEth(0))
    await token.mint(debtToken.address, parseEth(500))
    expect(await debtToken.balance()).to.eq(parseEth(500))
    await debtToken.connect(lender).redeem(parseEth(250))
    expect(await debtToken.balance()).to.eq(parseEth(250))
    await token.mint(debtToken.address, parseEth(501))
    await debtToken.connect(lender).redeem(parseEth(750))
    expect(await debtToken.balance()).to.eq(parseEth(0))
  })
})
