import { expect } from 'chai'
import {
  beforeEachWithFixture,
  createLoan,
  DAY,
  parseTRU,
  parseUSDC,
  parseEth,
  setupTruefi2,
  timeTravel as _timeTravel,
  createDebtToken as _createDebtToken,
  createLegacyLoan,
} from 'utils'
import { setupDeploy } from 'scripts/utils'
import { BigNumberish, utils, Wallet } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

import {
  BorrowingMutex,
  DeficiencyToken__factory,
  Liquidator2,
  TestLegacyLoanToken2,
  TestLegacyLoanToken2__factory,
  TestLoanFactory,
  TestLoanFactory__factory,
  TestTrueLender,
  TestTrueLender__factory,
  Mock1InchV3,
  Mock1InchV3__factory,
  MockTrueCurrency,
  MockUsdc,
  Safu,
  StkTruToken,
  TrueFiPool2,
  TrueFiPool2__factory,
  PoolFactory,
  TrueFiCreditOracle,
  DebtToken,
  DebtToken__factory,
  MockErc20Token__factory,
  MockTrueFiPoolOracle__factory,
  MockErc20Token,
  CreditModel,
  CollateralVault,
} from 'contracts'

import {
  Mock1InchV3Json,
} from 'build'

describe('SAFU', () => {
  let owner: Wallet, borrower: Wallet, voter: Wallet

  let safu: Safu
  let token: MockUsdc
  let lender: TestTrueLender
  let debt: DebtToken
  let loanFactory: TestLoanFactory
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let oneInch: Mock1InchV3
  let liquidator: Liquidator2
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let creditOracle: TrueFiCreditOracle
  let borrowingMutex: BorrowingMutex
  let creditModel: CreditModel
  let collateralVault: CollateralVault

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + 3 * DAY

  const defaultAmount = parseUSDC(1100)

  const createDebtToken = async (pool: TrueFiPool2, debt: BigNumberish) => {
    return _createDebtToken(loanFactory, owner, owner, pool, borrower, debt)
  }

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, borrower, voter] = _wallets
    const deployContract = setupDeploy(owner)
    timeTravel = (time: number) => _timeTravel(_provider, time)

    lender = await deployContract(TestTrueLender__factory)
    loanFactory = await deployContract(TestLoanFactory__factory)

    oneInch = await new Mock1InchV3__factory(owner).deploy()
    ; ({
      safu,
      feeToken: token,
      feePool: pool,
      poolFactory,
      tru,
      stkTru,
      liquidator,
      creditOracle,
      borrowingMutex,
      creditModel,
      collateralVault,
    } = await setupTruefi2(owner, _provider, { lender: lender, loanFactory: loanFactory, oneInch: oneInch }))

    await token.mint(owner.address, parseUSDC(1e7))
    await token.approve(pool.address, parseUSDC(1e7))
    await pool.connect(owner).join(parseUSDC(1e7))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
    await creditModel.setRiskPremium(400)

    debt = await createDebtToken(pool, defaultAmount)

    await tru.mint(owner.address, parseTRU(1e7))
    await tru.approve(stkTru.address, parseTRU(1e7))
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
      it('not called by the owner', async () => {
        await expect(safu.connect(borrower).liquidate([debt.address]))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('debt is not created by factory', async () => {
        const strangerDebt = await new DebtToken__factory(owner).deploy()
        await strangerDebt.initialize(pool.address, owner.address, owner.address, owner.address, defaultAmount)
        await expect(safu.liquidate([strangerDebt.address]))
          .to.be.revertedWith('SAFU: Unknown debt')
      })

      it('debt has already been liquidated', async () => {
        await safu.liquidate([debt.address])
        await expect(safu.liquidate([debt.address]))
          .to.be.revertedWith('SAFU: Debt is not defaulted')
      })
    })

    describe('Handles debt tokens', () => {
      let debtToken: DebtToken

      beforeEach(async () => {
        await token.mint(safu.address, defaultAmount)
        await loanFactory.setCreditAgency(owner.address)
        await pool.setCreditAgency(owner.address)
        debtToken = await createDebtToken(pool, defaultAmount)
        await debtToken.approve(pool.address, defaultAmount)
        await pool.addDebt(debtToken.address, defaultAmount)
      })

      it('transfers DebtTokens to the SAFU', async () => {
        await safu.liquidate([debtToken.address])
        await expect(await debtToken.balanceOf(safu.address)).to.equal(defaultAmount)
      })

      describe('Slashes staked tru from CollateralVault', () => {
        it('works with no tru staked', async () => {
          await safu.liquidate([debtToken.address])
          expect(await tru.balanceOf(safu.address)).to.equal(0)
        })

        it('works with tru staked', async () => {
          await tru.mint(borrower.address, parseTRU(100))
          await tru.connect(borrower).approve(collateralVault.address, parseTRU(100))
          await collateralVault.connect(borrower).stake(parseTRU(100))

          await borrowingMutex.allowLocker(owner.address, true)
          await borrowingMutex.lock(borrower.address, owner.address)
          await borrowingMutex.ban(borrower.address)

          await safu.liquidate([debtToken.address])
          expect(await tru.balanceOf(safu.address)).to.eq(parseTRU(100))
        })
      })
    })

    const createSupportedPool = async (poolFactory: PoolFactory): Promise<[TrueFiPool2, MockErc20Token]> => {
      const poolImplementation = await new TrueFiPool2__factory(owner).deploy()
      const token = await new MockErc20Token__factory(owner).deploy()
      const tokenOracle = await new MockTrueFiPoolOracle__factory(owner).deploy(token.address)
      await poolFactory.allowToken(token.address, true)
      await poolFactory.createPool(token.address)
      const pool = poolImplementation.attach(await poolFactory.pool(token.address))
      await poolFactory.supportPool(pool.address)
      await pool.setOracle(tokenOracle.address)
      await token.mint(owner.address, parseUSDC(1e7))
      await token.approve(pool.address, parseUSDC(1e7))
      await pool.connect(owner).join(parseUSDC(1e7))
      return [pool, token]
    }

    describe('Handles debt repay', () => {

      describe('Safu has funds to cover, all debt tokens are in pool', () => {
        beforeEach(async () => {
          await token.mint(safu.address, defaultAmount)
        })

        it('takes funds from safu', async () => {
          await expect(() => safu.liquidate([debt.address]))
            .to.changeTokenBalance(token, safu, defaultAmount.mul(-1))
        })

        it('transfers funds to the pool', async () => {
          await expect(() => safu.liquidate([debt.address]))
            .to.changeTokenBalance(token, pool, defaultAmount)
        })

        it('sets deficiencyToken', async () => {
          await safu.liquidate([debt.address])
          expect(await safu.deficiencyToken(debt.address)).to.eq(AddressZero)
        })

        it('increases pool deficit', async () => {
          await safu.liquidate([debt.address])
          expect(await safu.poolDeficit(pool.address)).to.eq(0)
        })

        it('emits event', async () => {
          await expect(safu.liquidate([debt.address]))
            .to.emit(safu, 'Liquidated')
            .withArgs(debt.address, defaultAmount, AddressZero, 0)
        })

        it('handles multiple debt tokens', async () => {
          const [pool2, token2] = await createSupportedPool(poolFactory)
          await token2.mint(safu.address, defaultAmount)

          await loanFactory.setCreditAgency(owner.address)
          await pool.setCreditAgency(owner.address)
          await pool2.setCreditAgency(owner.address)

          const debtToken1 = await createDebtToken(pool, defaultAmount.mul(3).div(4))
          await debtToken1.approve(pool.address, defaultAmount.mul(3).div(4))
          await pool.addDebt(debtToken1.address, defaultAmount.mul(3).div(4))

          const debtToken2 = await createDebtToken(pool2, defaultAmount.mul(1).div(4))
          await debtToken2.approve(pool2.address, defaultAmount.mul(1).div(4))
          await pool2.addDebt(debtToken2.address, defaultAmount.mul(1).div(4))

          await safu.liquidate([debtToken1.address, debtToken2.address])
          expect(await safu.poolDeficit(pool.address)).to.eq(0)
          expect(await safu.poolDeficit(pool2.address)).to.eq(0)
          expect(await token.balanceOf(safu.address)).to.eq(defaultAmount.div(4))
          expect(await token2.balanceOf(safu.address)).to.eq(defaultAmount.mul(3).div(4))
        })
      })

      describe('Safu does not have funds to cover, all debt tokens are in pool', () => {
        beforeEach(async () => {
          await token.mint(safu.address, defaultAmount.div(2))
        })

        it('takes funds from safu', async () => {
          await expect(() => safu.liquidate([debt.address]))
            .to.changeTokenBalance(token, safu, defaultAmount.div(2).mul(-1))
        })

        it('transfers funds to the pool', async () => {
          await expect(() => safu.liquidate([debt.address]))
            .to.changeTokenBalance(token, pool, defaultAmount.div(2))
        })

        it('sets deficiencyToken', async () => {
          const tx = await safu.liquidate([debt.address])
          const deficiencyToken = (await tx.wait()).events[8].args.deficiencyToken
          expect(await safu.deficiencyToken(debt.address)).to.eq(deficiencyToken)
        })

        it('increases pool deficit', async () => {
          await safu.liquidate([debt.address])
          expect(await safu.poolDeficit(pool.address)).to.eq(defaultAmount.div(2))
        })

        it('emits event', async () => {
          const tx = await safu.liquidate([debt.address])
          await expect(tx)
            .to.emit(safu, 'Liquidated')
            .withArgs(debt.address, defaultAmount.div(2), await safu.deficiencyToken(debt.address), defaultAmount.div(2))
        })

        it('handles multiple debt tokens', async () => {
          const [pool2, token2] = await createSupportedPool(poolFactory)
          await token2.mint(safu.address, defaultAmount.div(2))

          await loanFactory.setCreditAgency(owner.address)
          await pool.setCreditAgency(owner.address)
          await pool2.setCreditAgency(owner.address)

          const debtToken1 = await createDebtToken(pool, defaultAmount.mul(3).div(4))
          await debtToken1.approve(pool.address, defaultAmount.mul(3).div(4))
          await pool.addDebt(debtToken1.address, defaultAmount.mul(3).div(4))

          const debtToken2 = await createDebtToken(pool2, defaultAmount)
          await debtToken2.approve(pool2.address, defaultAmount)
          await pool2.addDebt(debtToken2.address, defaultAmount)

          await safu.liquidate([debtToken1.address, debtToken2.address])
          expect(await safu.poolDeficit(pool.address)).to.eq(defaultAmount.div(4))
          expect(await safu.poolDeficit(pool2.address)).to.eq(defaultAmount.div(2))
          expect(await token.balanceOf(safu.address)).to.eq(0)
          expect(await token2.balanceOf(safu.address)).to.eq(0)
        })
      })
    })

    describe('Slashes tru', () => {
      beforeEach(async () => {
        await token.mint(safu.address, defaultAmount)
        await loanFactory.setCreditAgency(owner.address)
        await pool.setCreditAgency(owner.address)
      })

      describe('Debt not repaid at all', () => {
        it('0 tru in staking pool balance', async () => {
          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.eq(0)
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(1e2))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(4400))
        })

        it('also slashes collateral vault tru', async () => {
          await stkTru.stake(parseTRU(1e3))

          await tru.mint(borrower.address, parseTRU(100))
          await tru.connect(borrower).approve(collateralVault.address, parseTRU(100))
          await collateralVault.connect(borrower).stake(parseTRU(100))

          await borrowingMutex.allowLocker(owner.address, true)
          await borrowingMutex.lock(borrower.address, owner.address)
          await borrowingMutex.ban(borrower.address)

          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.eq(parseTRU(2e2))
        })
      })

      describe('Half of debt repaid', () => {
        beforeEach(async () => {
          await token.mint(debt.address, parseUSDC(550))
        })

        it('0 tru in staking pool balance', async () => {
          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await safu.liquidate([debt.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(22e2))
        })
      })

      describe('Multiple debt tokens', async () => {
        let debt2: DebtToken

        beforeEach(async () => {
          await token.mint(safu.address, defaultAmount)
          debt2 = await createDebtToken(pool, defaultAmount)
          await debt2.approve(pool.address, defaultAmount)
          await pool.addDebt(debt2.address, defaultAmount)
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(4400 * 15))

          await safu.liquidate([debt.address, debt2.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(4400 * 15 / 10))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await safu.liquidate([debt.address, debt2.address])
          expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(4400 * 2))
        })
      })
    })
  })

  describe('reclaim', () => {
    beforeEach(async () => {
      await token.mint(safu.address, defaultAmount.div(2))
      await safu.liquidate([debt.address])
    })

    describe('reverts if', () => {
      it('debt is not created by factory', async () => {
        const strangerDebt = await new DebtToken__factory(owner).deploy()
        await strangerDebt.initialize(pool.address, owner.address, owner.address, owner.address, defaultAmount)
        await expect(safu.reclaim(strangerDebt.address, 0))
          .to.be.revertedWith('SAFU: Unknown debt')
      })

      it('caller is not loan pool', async () => {
        await expect(safu.connect(voter).reclaim(debt.address, 100))
          .to.be.revertedWith('SAFU: caller is not the debt\'s pool')
      })

      it('debt was not fully redeemed by safu', async () => {
        await expect(pool.reclaimDeficit(debt.address))
          .to.be.revertedWith('SAFU: Debt has to be fully redeemed by SAFU')
      })

      it('debt does not have an associated deficiency token', async () => {
        const debt2 = await createDebtToken(pool, defaultAmount)
        await expect(pool.reclaimDeficit(debt2.address))
          .to.be.revertedWith('TrueFiPool2: No deficiency token found for debt')
      })

      it('caller does not have deficit tokens', async () => {
        await token.mint(debt.address, defaultAmount)
        await safu.redeem(debt.address)
        // Reclaim twice. The second time should fail because the pool has no deficiency tokens.
        await pool.reclaimDeficit(debt.address)
        await expect(pool.reclaimDeficit(debt.address))
          .to.be.revertedWith('SAFU: Pool does not have deficiency tokens to be reclaimed')
      })
    })

    describe('Handles debt repay', () => {
      beforeEach(async () => {
        await token.mint(debt.address, defaultAmount)
        await safu.redeem(debt.address)
      })

      it('burns deficiency tokens', async () => {
        const dToken = new DeficiencyToken__factory(owner).attach(await safu.deficiencyToken(debt.address))
        expect(await dToken.totalSupply()).to.eq(defaultAmount.div(2))
        await pool.reclaimDeficit(debt.address)
        expect(await dToken.totalSupply()).to.eq(0)
      })

      it('decreases pool deficit', async () => {
        await pool.reclaimDeficit(debt.address)
        expect(await safu.poolDeficit(pool.address)).to.eq(0)
      })

      it('transfers deficit to the pool', async () => {
        await expect(() => pool.reclaimDeficit(debt.address)).changeTokenBalance(token, pool, defaultAmount.div(2))
      })

      it('transfers deficit from the safu', async () => {
        await expect(() => pool.reclaimDeficit(debt.address)).changeTokenBalance(token, safu, defaultAmount.div(2).mul(-1))
      })

      it('safu keeps excessive funds', async () => {
        await pool.reclaimDeficit(debt.address)
        expect(await token.balanceOf(safu.address)).to.eq(defaultAmount.div(2))
      })

      it('emits event', async () => {
        await expect(pool.reclaimDeficit(debt.address))
          .to.emit(safu, 'Reclaimed')
          .withArgs(debt.address, defaultAmount.div(2))
      })
    })
  })

  describe('redeem', () => {
    describe('reverts if', () => {
      it('caller is not manager', async () => {
        await safu.liquidate([debt.address])
        await expect(safu.connect(borrower).redeem(debt.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
  
      it('debt is not created by factory', async () => {
        const strangerDebt = await new DebtToken__factory(owner).deploy()
        await strangerDebt.initialize(pool.address, owner.address, owner.address, owner.address, defaultAmount)
        await expect(safu.redeem(strangerDebt.address))
          .to.be.revertedWith('SAFU: Unknown debt')
      })
    })

    it('burns debt tokens', async () => {
      await safu.legacyLiquidate(debt.address)
      await expect(() => safu.redeem(debt.address)).changeTokenBalance(debt, safu, parseUSDC(1100).mul(-1))
    })

    it('redeems available tokens', async () => {
      await safu.liquidate([debt.address])
      await token.mint(debt.address, parseUSDC(25))
      await expect(() => safu.redeem(debt.address)).changeTokenBalance(token, safu, parseUSDC(25))
    })

    it('emits a proper event', async () => {
      await safu.liquidate([debt.address])
      await token.mint(debt.address, parseUSDC(25))

      const debtTokensToBurn = await debt.balanceOf(safu.address)
      const currencyTokensToRedeem = await token.balanceOf(debt.address)

      await expect(safu.redeem(debt.address))
        .to.emit(safu, 'Redeemed')
        .withArgs(debt.address, debtTokensToBurn, currencyTokensToRedeem)
    })
  })

  describe('swap', () => {
    const encodeData = (fromToken: string, toToken: string, sender: string, receiver: string, amount: BigNumberish, flags = 0) => {
      const iface = new utils.Interface(Mock1InchV3Json.abi)
      return iface.encodeFunctionData('swap', [AddressZero, {
        srcToken: fromToken,
        dstToken: toToken,
        srcReceiver: sender,
        dstReceiver: receiver,
        amount: amount,
        minReturnAmount: 0,
        flags: flags,
        permit: '0x',
      }, '0x'])
    }

    it('emits a proper event', async () => {
      await tru.mint(safu.address, parseTRU(5))
      await oneInch.setOutputAmount(parseUSDC(10))
      const data = encodeData(tru.address, token.address, safu.address, safu.address, parseTRU(5))
      await expect(safu.swap(data, 0))
        .to.emit(safu, 'Swapped')
        .withArgs(parseTRU(5), tru.address, parseUSDC(10), token.address)
    })
  })

  describe('legacy', () => {
    let loan: TestLegacyLoanToken2

    beforeEach(async () => {
      loan = await createLegacyLoan(loanFactory, pool, lender, owner, borrower, parseUSDC(1000), YEAR, 1000)
      await token.mint(lender.address, parseUSDC(1000))
      await lender.fund(loan.address)
      await loan.connect(borrower).withdraw(borrower.address)
    })

    describe('liquidate', () => {
      describe('reverts if', () => {
        it('loan is not defaulted', async () => {
          await expect(safu.legacyLiquidate(loan.address))
            .to.be.revertedWith('SAFU: Loan is not defaulted')
        })

        it('loan is not created by factory', async () => {
          const strangerLoan = await new TestLegacyLoanToken2__factory(owner).deploy()
          await strangerLoan.initialize(pool.address, borrowingMutex.address, owner.address, owner.address, owner.address, owner.address, AddressZero, 1000, 1, 1)
          await expect(safu.legacyLiquidate(strangerLoan.address))
            .to.be.revertedWith('SAFU: Unknown loan')
        })

        it('loan has already been liquidated', async () => {
          await token.mint(safu.address, defaultAmount)
          await timeTravel(DAY * 400)
          await loan.enterDefault()

          await safu.legacyLiquidate(loan.address)
          await expect(safu.legacyLiquidate(loan.address))
            .to.be.revertedWith('SAFU: Loan is not defaulted')
        })
      })

      describe('Handles loan tokens', () => {
        beforeEach(async () => {
          await token.mint(safu.address, defaultAmount)
        })

        it('transfers LoanTokens to the SAFU', async () => {
          await timeTravel(DAY * 400)
          await loan.enterDefault()
          await safu.legacyLiquidate(loan.address)
          await expect(await loan.balanceOf(safu.address)).to.equal(defaultAmount)
        })
      })

      describe('Handles debt repay', () => {
        beforeEach(async () => {
          await timeTravel(DAY * 400)
          await loan.enterDefault()
        })

        describe('Safu has funds to cover, all loan tokens are in pool', () => {
          beforeEach(async () => {
            await token.mint(safu.address, defaultAmount)
          })

          it('takes funds from safu', async () => {
            await expect(() => safu.legacyLiquidate(loan.address))
              .to.changeTokenBalance(token, safu, defaultAmount.mul(-1))
          })

          it('transfers funds to the pool', async () => {
            await expect(() => safu.legacyLiquidate(loan.address))
              .to.changeTokenBalance(token, pool, defaultAmount)
          })

          it('sets deficiencyToken', async () => {
            await safu.legacyLiquidate(loan.address)
            expect(await safu.legacyDeficiencyToken(loan.address)).to.eq(AddressZero)
          })

          it('increases pool deficit', async () => {
            await safu.legacyLiquidate(loan.address)
            expect(await safu.poolDeficit(pool.address)).to.eq(0)
          })

          it('emits event', async () => {
            await expect(safu.legacyLiquidate(loan.address))
              .to.emit(safu, 'Liquidated')
              .withArgs(loan.address, defaultAmount, AddressZero, 0)
          })
        })

        describe('Safu does not have funds to cover, all loan tokens are in pool', () => {
          beforeEach(async () => {
            await token.mint(safu.address, defaultAmount.div(2))
          })

          it('takes funds from safu', async () => {
            await expect(() => safu.legacyLiquidate(loan.address))
              .to.changeTokenBalance(token, safu, defaultAmount.div(2).mul(-1))
          })

          it('transfers funds to the pool', async () => {
            await expect(() => safu.legacyLiquidate(loan.address))
              .to.changeTokenBalance(token, pool, defaultAmount.div(2))
          })

          it('sets deficiencyToken', async () => {
            const tx = await safu.legacyLiquidate(loan.address)
            const deficiencyToken = (await tx.wait()).events[8].args.deficiencyToken
            expect(await safu.legacyDeficiencyToken(loan.address)).to.eq(deficiencyToken)
          })

          it('increases pool deficit', async () => {
            await safu.legacyLiquidate(loan.address)
            expect(await safu.poolDeficit(pool.address)).to.eq(defaultAmount.div(2))
          })

          it('emits event', async () => {
            const tx = await safu.legacyLiquidate(loan.address)
            await expect(tx)
              .to.emit(safu, 'Liquidated')
              .withArgs(loan.address, defaultAmount.div(2), await safu.legacyDeficiencyToken(loan.address), defaultAmount.div(2))
          })
        })
      })

      describe('Slashes tru', () => {
        beforeEach(async () => {
          await token.mint(safu.address, defaultAmount)
          await timeTravel(defaultedLoanCloseTime)
          await loan.enterDefault()
        })

        describe('Loan not repaid at all', () => {
          it('0 tru in staking pool balance', async () => {
            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.eq(0)
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(1e2))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(4400))
          })
        })

        describe('Half of loan repaid', () => {
          beforeEach(async () => {
            await token.mint(loan.address, parseUSDC(550))
          })

          it('0 tru in staking pool balance', async () => {
            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(0))
          })

          it('returns max fetch share to assurance', async () => {
            await stkTru.stake(parseTRU(1e3))

            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(100))
          })

          it('returns defaulted value', async () => {
            await stkTru.stake(parseTRU(1e7))

            await safu.legacyLiquidate(loan.address)
            expect(await tru.balanceOf(safu.address)).to.equal(parseTRU(22e2))
          })
        })
      })
    })

    describe('reclaim', () => {
      beforeEach(async () => {
        await timeTravel(DAY * 400)
        await loan.enterDefault()
        await token.mint(safu.address, defaultAmount.div(2))
        await safu.legacyLiquidate(loan.address)
      })

      describe('Reverts if', () => {
        it('loan is not created by factory', async () => {
          const strangerLoan = await new TestLegacyLoanToken2__factory(owner).deploy()
          await strangerLoan.initialize(pool.address, borrowingMutex.address, owner.address, owner.address, owner.address, owner.address, AddressZero, 1000, 1, 1)
          await expect(safu.legacyReclaim(strangerLoan.address, 0))
            .to.be.revertedWith('SAFU: Unknown loan')
        })

        it('caller is not loan pool', async () => {
          await expect(safu.connect(voter).legacyReclaim(loan.address, 100))
            .to.be.revertedWith('SAFU: caller is not the loan\'s pool')
        })

        it('loan was not fully redeemed by safu', async () => {
          await expect(pool.reclaimLegacyDeficit(loan.address))
            .to.be.revertedWith('SAFU: Loan has to be fully redeemed by SAFU')
        })

        it('loan does not have an associated deficiency token', async () => {
          const noSAFULoan = await createLoan(loanFactory, borrower, pool, parseUSDC(1000), YEAR, 1000)
          await expect(pool.reclaimLegacyDeficit(noSAFULoan.address))
            .to.be.revertedWith('TrueFiPool2: No deficiency token found for loan')
        })

        it('caller does not have deficit tokens', async () => {
          await token.mint(loan.address, defaultAmount)
          await safu.legacyRedeem(loan.address)
          // Reclaim twice. The second time should fail because the pool has no deficiency tokens.
          await pool.reclaimLegacyDeficit(loan.address)
          await expect(pool.reclaimLegacyDeficit(loan.address))
            .to.be.revertedWith('SAFU: Pool does not have deficiency tokens to be reclaimed')
        })
      })

      describe('Handles debt repay', () => {
        beforeEach(async () => {
          await token.mint(loan.address, defaultAmount)
          await safu.legacyRedeem(loan.address)
        })

        it('burns deficiency tokens', async () => {
          const dToken = new DeficiencyToken__factory(owner).attach(await safu.legacyDeficiencyToken(loan.address))
          expect(await dToken.totalSupply()).to.eq(defaultAmount.div(2))
          await pool.reclaimLegacyDeficit(loan.address)
          expect(await dToken.totalSupply()).to.eq(0)
        })

        it('decreases pool deficit', async () => {
          await pool.reclaimLegacyDeficit(loan.address)
          expect(await safu.poolDeficit(pool.address)).to.eq(0)
        })

        it('transfers deficit to the pool', async () => {
          await expect(() => pool.reclaimLegacyDeficit(loan.address)).changeTokenBalance(token, pool, defaultAmount.div(2))
        })

        it('transfers deficit from the safu', async () => {
          await expect(() => pool.reclaimLegacyDeficit(loan.address)).changeTokenBalance(token, safu, defaultAmount.div(2).mul(-1))
        })

        it('safu keeps excessive funds', async () => {
          await pool.reclaimLegacyDeficit(loan.address)
          expect(await token.balanceOf(safu.address)).to.eq(defaultAmount.div(2))
        })

        it('emits event', async () => {
          await expect(pool.reclaimLegacyDeficit(loan.address))
            .to.emit(safu, 'Reclaimed')
            .withArgs(loan.address, defaultAmount.div(2))
        })
      })
    })

    describe('redeem', () => {
      beforeEach(async () => {
        await timeTravel(DAY * 400)
        await loan.enterDefault()
      })

      it('only manager can call it', async () => {
        await safu.legacyLiquidate(loan.address)
        await expect(safu.connect(borrower).legacyRedeem(loan.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('reverts if loan is not created by factory', async () => {
        const strangerLoan = await new TestLegacyLoanToken2__factory(owner).deploy()
        await strangerLoan.initialize(pool.address, borrowingMutex.address, owner.address, owner.address, owner.address, owner.address, AddressZero, 1000, 1, 1)
        await expect(safu.legacyRedeem(strangerLoan.address))
          .to.be.revertedWith('SAFU: Unknown loan')
      })

      it('burns loan tokens', async () => {
        await safu.legacyLiquidate(loan.address)
        await expect(() => safu.legacyRedeem(loan.address)).changeTokenBalance(loan, safu, parseUSDC(1100).mul(-1))
      })

      it('redeems available tokens', async () => {
        await safu.legacyLiquidate(loan.address)
        await token.mint(loan.address, parseUSDC(25))
        await expect(() => safu.legacyRedeem(loan.address)).changeTokenBalance(token, safu, parseUSDC(25))
      })

      it('emits a proper event', async () => {
        await safu.legacyLiquidate(loan.address)
        await token.mint(loan.address, parseUSDC(25))

        const loanTokensToBurn = await loan.balanceOf(safu.address)
        const currencyTokensToRedeem = await token.balanceOf(loan.address)

        await expect(safu.legacyRedeem(loan.address))
          .to.emit(safu, 'Redeemed')
          .withArgs(loan.address, loanTokensToBurn, currencyTokensToRedeem)
      })
    })
  })
})
