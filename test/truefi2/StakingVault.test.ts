import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import {
  parseEth,
  parseTRU,
  parseUSDC,
} from 'utils'
import { createDebtToken } from 'fixtures/createLoan'
import { setupTruefi2 } from 'fixtures/setupTruefi2'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import {
  BorrowingMutex,
  StakingVault,
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

describe('StakingVault', () => {
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

  let stakingVault: StakingVault

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, safu] = wallets

    ; ({
      tru,
      borrowingMutex,
      creditAgency,
      liquidator,
      stakingVault,
      creditOracle,
      standardPool: pool,
      standardToken: poolToken,
      loanFactory,
    } = await setupTruefi2(owner, _provider))
    await pool.setCreditAgency(creditAgency.address)
    await borrowingMutex.allowLocker(owner.address, true)

    await tru.mint(borrower.address, parseTRU(100))
    await tru.connect(borrower).approve(stakingVault.address, parseTRU(100))

    await pool.setCreditAgency(creditAgency.address)
    await poolToken.mint(owner.address, parseEth(2e7))
    await poolToken.approve(pool.address, parseEth(2e7))
    await pool.join(parseEth(2e7))

    await liquidator.setAssurance(safu.address)

    await creditAgency.allowBorrower(borrower.address, true)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await stakingVault.owner()).to.eq(owner.address)
    })

    it('sets stakedToken', async () => {
      expect(await stakingVault.stakedToken()).to.eq(tru.address)
    })

    it('sets borrowingMutex', async () => {
      expect(await stakingVault.borrowingMutex()).to.eq(borrowingMutex.address)
    })

    it('sets lineOfCreditAgency', async () => {
      expect(await stakingVault.lineOfCreditAgency()).to.eq(creditAgency.address)
    })

    it('sets liquidator', async () => {
      expect(await stakingVault.liquidator()).to.eq(liquidator.address)
    })
  })

  describe('stake', () => {
    it('allows to stake only if mutex is unlocked or is locked by LOCAgency', async () => {
      await expect(stakingVault.connect(borrower).stake(parseTRU(50)))
        .not.to.be.reverted

      await borrowingMutex.lock(borrower.address, owner.address)
      await expect(stakingVault.connect(borrower).stake(parseTRU(100)))
        .to.be.revertedWith('StakingVault: Borrower can only stake when they\'re unlocked or have a line of credit')

      await borrowingMutex.unlock(borrower.address)
      await borrowingMutex.lock(borrower.address, creditAgency.address)
      await expect(stakingVault.connect(borrower).stake(parseTRU(50)))
        .not.to.be.reverted
    })

    it('transfers tru to the vault', async () => {
      expect(await tru.balanceOf(stakingVault.address)).to.be.eq(0)
      expect(await tru.balanceOf(borrower.address)).to.be.eq(parseTRU(100))
      await stakingVault.connect(borrower).stake(parseTRU(100))
      expect(await tru.balanceOf(stakingVault.address)).to.be.eq(parseTRU(100))
      expect(await tru.balanceOf(borrower.address)).to.be.eq(0)
    })

    it('increases stakedAmount', async () => {
      expect(await stakingVault.stakedAmount(borrower.address)).to.be.eq(0)
      await stakingVault.connect(borrower).stake(parseTRU(100))
      expect(await stakingVault.stakedAmount(borrower.address)).to.be.eq(parseTRU(100))
    })

    it('updates credit score', async () => {
      await creditOracle.setScore(borrower.address, 223)
      await creditAgency.connect(borrower).borrow(pool.address, parseEth(25))
      await stakingVault.connect(borrower).stake(parseTRU(100))
      expect(await creditAgency.creditScore(pool.address, borrower.address)).to.eq(235)
    })

    it('emits event', async () => {
      await expect(stakingVault.connect(borrower).stake(parseTRU(100)))
        .to.emit(stakingVault, 'Staked')
        .withArgs(borrower.address, parseTRU(100))
    })
  })

  describe('canUnstake', () => {
    beforeEach(async () => {
      await stakingVault.connect(borrower).stake(parseTRU(100))
    })

    it('is true when amount is below staked', async () => {
      expect(await stakingVault.canUnstake(borrower.address, parseTRU(100))).to.be.true
    })

    it('is false when amount exceeds staked', async () => {
      expect(await stakingVault.canUnstake(borrower.address, parseTRU(100).add(1))).to.be.false
    })

    it('is false when locked but not by credit agency', async () => {
      await borrowingMutex.lock(borrower.address, owner.address)
      expect(await stakingVault.canUnstake(borrower.address, parseTRU(100))).to.be.false
    })

    describe('When borrower has open credit line', () => {
      beforeEach(async () => {
        await creditOracle.setScore(borrower.address, 200)
        await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100))
        await poolToken.mint(owner.address, parseEth(1e7))
        await poolToken.approve(pool.address, parseEth(1e7))
        await pool.join(parseEth(1e7))
        await creditAgency.allowBorrower(borrower.address, true)
        const totalBorrowed = await creditAgency.totalBorrowed(borrower.address)
        const borrowLimit = await creditAgency.borrowLimit(pool.address, borrower.address, totalBorrowed)
        await creditAgency.connect(borrower).borrow(pool.address, borrowLimit.sub(parseEth(5)))
      })

      it('can unstake if as a result borrowed amount does not exceed borrow limit', async () => {
        expect(await stakingVault.canUnstake(borrower.address, parseTRU(30))).to.be.true
        await expect(stakingVault.connect(borrower).unstake(parseTRU(30)))
          .to.not.be.reverted
      })

      it('cannot unstake if as a result borrowed amount exceeds borrow limit', async () => {
        expect(await stakingVault.canUnstake(borrower.address, parseTRU(60))).to.be.false
        await expect(stakingVault.connect(borrower).unstake(parseTRU(60)))
          .to.be.revertedWith('StakingVault: Cannot unstake')
      })
    })
  })

  describe('unstake', () => {
    beforeEach(async () => {
      await stakingVault.connect(borrower).stake(parseTRU(100))
    })

    it('transfers tokens back to staker', async () => {
      await expect(() => stakingVault.connect(borrower).unstake(parseTRU(100)))
        .to.changeTokenBalances(tru, [stakingVault, borrower], [-parseTRU(100), parseTRU(100)])
    })

    it('decreases stakedAmount', async () => {
      await stakingVault.connect(borrower).unstake(parseTRU(40))
      expect(await stakingVault.stakedAmount(borrower.address)).to.equal(parseTRU(60))
    })

    it('cannot unstake more than staked', async () => {
      await expect(stakingVault.connect(borrower).unstake(parseTRU(101)))
        .to.be.revertedWith('StakingVault: Cannot unstake')
    })

    it('cannot unstake if mutex is locked', async () => {
      await borrowingMutex.lock(borrower.address, owner.address)
      await expect(stakingVault.connect(borrower).unstake(parseTRU(101)))
        .to.be.revertedWith('StakingVault: Cannot unstake')
    })

    it('updates credit score', async () => {
      await creditOracle.setScore(borrower.address, 223)
      await creditAgency.connect(borrower).borrow(pool.address, parseEth(25))
      expect(await creditAgency.creditScore(pool.address, borrower.address)).to.eq(235)
      await stakingVault.connect(borrower).unstake(parseTRU(100))
      expect(await creditAgency.creditScore(pool.address, borrower.address)).to.eq(223)
    })

    it('emits event', async () => {
      await expect(stakingVault.connect(borrower).unstake(parseTRU(100)))
        .to.emit(stakingVault, 'Unstaked')
        .withArgs(borrower.address, parseTRU(100))
    })
  })

  describe('slash', () => {
    let debtToken: DebtToken

    beforeEach(async () => {
      await stakingVault.connect(borrower).stake(parseTRU(100))
      debtToken = await createDebtToken(loanFactory, owner, owner, pool, borrower, parseUSDC(1000))
      await borrowingMutex.lock(borrower.address, owner.address)
    })

    describe('reverts if', () => {
      it('liquidator is not the caller', async () => {
        await expect(stakingVault.connect(owner).slash(borrower.address))
          .to.be.revertedWith('StakingVault: Caller is not the liquidator')
      })

      it('borrower is not banned', async () => {
        await expect(liquidator.connect(safu).liquidate([debtToken.address]))
          .to.be.revertedWith('StakingVault: Borrower has to be banned')
      })
    })

    it('reduces staked amount to 0', async () => {
      await borrowingMutex.ban(borrower.address)
      await liquidator.connect(safu).liquidate([debtToken.address])
      await expect(await stakingVault.stakedAmount(borrower.address)).to.eq(0)
    })

    it('transfers staked tru to safu', async () => {
      await borrowingMutex.ban(borrower.address)
      await expect(() => liquidator.connect(safu).liquidate([debtToken.address]))
        .to.changeTokenBalance(tru, safu, parseTRU(100))
    })

    it('emits event', async () => {
      await borrowingMutex.ban(borrower.address)
      await expect(liquidator.connect(safu).liquidate([debtToken.address]))
        .to.emit(stakingVault, 'Slashed')
        .withArgs(borrower.address, parseTRU(100))
    })
  })
})
