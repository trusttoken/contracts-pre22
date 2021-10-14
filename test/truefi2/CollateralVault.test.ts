import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import {
  beforeEachWithFixture,
  parseEth,
  parseTRU,
  setupTruefi2,
  createDebtToken,
  parseUSDC,
} from 'utils'
import {
  BorrowingMutex,
  CollateralVault,
  Ierc20,
  DebtToken,
  LineOfCreditAgency,
  Liquidator2,
  LoanFactory2,
  MockTrueCurrency,
  TrueFiCreditOracle,
  TrueFiPool2,
} from 'contracts'

use(solidity)

describe('CollateralVault', () => {
  let owner: Wallet
  let borrower: Wallet
  let safu: Wallet

  let tru: MockTrueCurrency
  let borrowingMutex: BorrowingMutex
  let creditAgency: LineOfCreditAgency
  let liquidator: Liquidator2
  let creditOracle: TrueFiCreditOracle
  let pool: TrueFiPool2
  let poolToken: Ierc20
  let loanFactory: LoanFactory2

  let collateralVault: CollateralVault

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, safu] = wallets

    ; ({
      tru,
      borrowingMutex,
      creditAgency,
      liquidator,
      collateralVault,
      creditOracle,
      standardPool: pool,
      standardToken: poolToken,
      loanFactory,
    } = await setupTruefi2(owner, _provider))
    await pool.setCreditAgency(creditAgency.address)
    await borrowingMutex.allowLocker(owner.address, true)

    await tru.mint(borrower.address, parseTRU(100))
    await tru.connect(borrower).approve(collateralVault.address, parseTRU(100))

    await liquidator.setAssurance(safu.address)
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await collateralVault.owner()).to.eq(owner.address)
    })

    it('sets stakedToken', async () => {
      expect(await collateralVault.stakedToken()).to.eq(tru.address)
    })

    it('sets borrowingMutex', async () => {
      expect(await collateralVault.borrowingMutex()).to.eq(borrowingMutex.address)
    })

    it('sets lineOfCreditAgency', async () => {
      expect(await collateralVault.lineOfCreditAgency()).to.eq(creditAgency.address)
    })

    it('sets liquidator', async () => {
      expect(await collateralVault.liquidator()).to.eq(liquidator.address)
    })
  })

  describe('stake', () => {
    it('allows to stake only if mutex is unlocked or is locked by LOCAgency', async () => {
      await expect(collateralVault.connect(borrower).stake(parseTRU(50)))
        .not.to.be.reverted

      await borrowingMutex.lock(borrower.address, owner.address)
      await expect(collateralVault.connect(borrower).stake(parseTRU(100)))
        .to.be.revertedWith('CollateralVault: Borrower can only stake when they\'re unlocked or have a line of credit')

      await borrowingMutex.unlock(borrower.address)
      await borrowingMutex.lock(borrower.address, creditAgency.address)
      await expect(collateralVault.connect(borrower).stake(parseTRU(50)))
        .not.to.be.reverted
    })

    it('transfers tru to the vault', async () => {
      expect(await tru.balanceOf(collateralVault.address)).to.be.eq(0)
      expect(await tru.balanceOf(borrower.address)).to.be.eq(parseTRU(100))
      await collateralVault.connect(borrower).stake(parseTRU(100))
      expect(await tru.balanceOf(collateralVault.address)).to.be.eq(parseTRU(100))
      expect(await tru.balanceOf(borrower.address)).to.be.eq(0)
    })

    it('increases stakedAmount', async () => {
      expect(await collateralVault.stakedAmount(borrower.address)).to.be.eq(0)
      await collateralVault.connect(borrower).stake(parseTRU(100))
      expect(await collateralVault.stakedAmount(borrower.address)).to.be.eq(parseTRU(100))
    })

    it('emits event', async () => {
      await expect(collateralVault.connect(borrower).stake(parseTRU(100)))
        .to.emit(collateralVault, 'Staked')
        .withArgs(borrower.address, parseTRU(100))
    })
  })

  describe('canUnstake', () => {
    beforeEach(async () => {
      await collateralVault.connect(borrower).stake(parseTRU(100))
    })

    it('is true when amount is below staked', async () => {
      expect(await collateralVault.canUnstake(borrower.address, parseTRU(100))).to.be.true
    })

    it('is false when amount exceeds staked', async () => {
      expect(await collateralVault.canUnstake(borrower.address, parseTRU(100).add(1))).to.be.false
    })

    it('is false when locked but not by credit agency', async () => {
      await borrowingMutex.lock(borrower.address, owner.address)
      expect(await collateralVault.canUnstake(borrower.address, parseTRU(100))).to.be.false
    })

    describe('When borrower has open credit line', () => {
      beforeEach(async () => {
        await creditOracle.setScore(borrower.address, 200)
        await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))
        await poolToken.mint(owner.address, parseEth(1e7))
        await poolToken.approve(pool.address, parseEth(1e7))
        await pool.join(parseEth(1e7))
        await creditAgency.allowBorrower(borrower.address, true)
        const borrowLimit = await creditAgency.borrowLimit(pool.address, borrower.address)
        await creditAgency.connect(borrower).borrow(pool.address, borrowLimit.sub(parseEth(5)))
      })

      it('can unstake if as a result borrowed amount does not exceed borrow limit', async () => {
        expect(await collateralVault.canUnstake(borrower.address, parseTRU(30))).to.be.true
        await expect(collateralVault.connect(borrower).unstake(parseTRU(30)))
          .to.not.be.reverted
      })

      it('cannot unstake if as a result borrowed amount exceeds borrow limit', async () => {
        expect(await collateralVault.canUnstake(borrower.address, parseTRU(60))).to.be.false
        await expect(collateralVault.connect(borrower).unstake(parseTRU(60)))
          .to.be.revertedWith('CollateralVault: Cannot unstake')
      })
    })
  })

  describe('unstake', () => {
    beforeEach(async () => {
      await collateralVault.connect(borrower).stake(parseTRU(100))
    })

    it('transfers tokens back to staker', async () => {
      await expect(() => collateralVault.connect(borrower).unstake(parseTRU(100)))
        .to.changeTokenBalances(tru, [collateralVault, borrower], [-parseTRU(100), parseTRU(100)])
    })

    it('decreases stakedAmount', async () => {
      await collateralVault.connect(borrower).unstake(parseTRU(40))
      expect(await collateralVault.stakedAmount(borrower.address)).to.equal(parseTRU(60))
    })

    it('cannot unstake more than staked', async () => {
      await expect(collateralVault.connect(borrower).unstake(parseTRU(101)))
        .to.be.revertedWith('CollateralVault: Cannot unstake')
    })

    it('cannot unstake if mutex is locked', async () => {
      await borrowingMutex.lock(borrower.address, owner.address)
      await expect(collateralVault.connect(borrower).unstake(parseTRU(101)))
        .to.be.revertedWith('CollateralVault: Cannot unstake')
    })

    it('emits event', async () => {
      await expect(collateralVault.connect(borrower).unstake(parseTRU(100)))
        .to.emit(collateralVault, 'Unstaked')
        .withArgs(borrower.address, parseTRU(100))
    })
  })

  describe('slash', () => {
    let debtToken: DebtToken

    beforeEach(async () => {
      await collateralVault.connect(borrower).stake(parseTRU(100))
      debtToken = await createDebtToken(loanFactory, owner, owner, pool, borrower, parseUSDC(1000))
      await borrowingMutex.lock(borrower.address, owner.address)
    })

    describe('reverts if', () => {
      it('liquidator is not the caller', async () => {
        await expect(collateralVault.connect(owner).slash(borrower.address))
          .to.be.revertedWith('CollateralVault: Caller is not the liquidator')
      })

      it('borrower is not banned', async () => {
        await expect(liquidator.connect(safu).liquidate([debtToken.address]))
          .to.be.revertedWith('CollateralVault: Borrower has to be banned')
      })
    })

    it('reduces staked amount to 0', async () => {
      await borrowingMutex.ban(borrower.address)
      await liquidator.connect(safu).liquidate([debtToken.address])
      await expect(await collateralVault.stakedAmount(borrower.address)).to.eq(0)
    })

    it('transfers staked tru to safu', async () => {
      await borrowingMutex.ban(borrower.address)
      await expect(() => liquidator.connect(safu).liquidate([debtToken.address]))
        .to.changeTokenBalance(tru, safu, parseTRU(100))
    })

    it('emits event', async () => {
      await borrowingMutex.ban(borrower.address)
      await expect(liquidator.connect(safu).liquidate([debtToken.address]))
        .to.emit(collateralVault, 'Slashed')
        .withArgs(borrower.address, parseTRU(100))
    })
  })
})
