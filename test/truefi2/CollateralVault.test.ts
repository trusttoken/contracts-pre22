import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture, parseTRU, setupTruefi2 } from 'utils'
import {
  BorrowingMutex,
  CollateralVault,
  LineOfCreditAgency,
  Liquidator2,
  MockTrueCurrency,
} from 'contracts'

use(solidity)

describe('CollateralVault', () => {
  let owner: Wallet
  let borrower: Wallet

  let tru: MockTrueCurrency
  let borrowingMutex: BorrowingMutex
  let creditAgency: LineOfCreditAgency
  let liquidator: Liquidator2

  let collateralVault: CollateralVault

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets

    ; ({
      tru,
      borrowingMutex,
      creditAgency,
      liquidator,
      collateralVault,
    } = await setupTruefi2(owner, _provider))

    await borrowingMutex.allowLocker(owner.address, true)

    await tru.mint(borrower.address, parseTRU(100))
    await tru.connect(borrower).approve(collateralVault.address, parseTRU(100))
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
      expect(collateralVault.connect(borrower).stake(parseTRU(100)))
        .to.emit(collateralVault, 'Staked')
        .withArgs(borrower.address, parseTRU(100))
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
        .to.be.revertedWith('CollateralVault: cannot unstake')
    })

    it('cannot unstake if mutex is locked', async () => {
      await borrowingMutex.lock(borrower.address, owner.address)
      await expect(collateralVault.connect(borrower).unstake(parseTRU(101)))
        .to.be.revertedWith('CollateralVault: cannot unstake')
    })

    it('emits event', async () => {
      expect(collateralVault.connect(borrower).unstake(parseTRU(100)))
        .to.emit(collateralVault, 'Unstaked')
        .withArgs(borrower.address, parseTRU(100))
    })
  })
})
