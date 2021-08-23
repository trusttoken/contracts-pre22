import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils'
import {
  BorrowingMutex,
  BorrowingMutex__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('BorrowingMutex', () => {
  let owner: Wallet
  let locker: Wallet
  let borrower: Wallet
  let mutex: BorrowingMutex

  beforeEachWithFixture(async (wallets) => {
    [owner, locker, borrower] = wallets
    const deployContract = setupDeploy(owner)
    mutex = await deployContract(BorrowingMutex__factory)
    await mutex.initialize()
    await mutex.allowLocker(locker.address, true)
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await mutex.owner()).to.eq(owner.address)
    })
  })

  describe('allowLocker', () => {
    it('only owner can call', async () => {
      await expect(mutex.connect(locker).allowLocker(locker.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(mutex.connect(owner).allowLocker(locker.address, true))
        .not.to.be.reverted
    })

    it('changes allowance status', async () => {
      expect(await mutex.canLock(owner.address)).to.eq(false)

      await mutex.allowLocker(owner.address, true)
      expect(await mutex.canLock(owner.address)).to.eq(true)

      await mutex.allowLocker(owner.address, false)
      expect(await mutex.canLock(owner.address)).to.eq(false)
    })
  })

  describe('lock', () => {
    it('sender not in canLock', async () => {
      await expect(mutex.connect(owner).lock(borrower.address, owner.address))
        .to.be.revertedWith('BorrowingMutex: Sender is not allowed to lock borrowers')

      await expect(mutex.connect(locker).lock(borrower.address, owner.address))
        .not.to.be.reverted
    })

    it('changes locker', async () => {
      await mutex.connect(locker).lock(borrower.address, owner.address)
      expect(await mutex.locker(borrower.address)).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(mutex.connect(locker).lock(borrower.address, owner.address))
        .to.emit(mutex, 'BorrowerLocked')
        .withArgs(borrower.address, owner.address)
    })
  })

  describe('unlock', () => {
    beforeEach(async () => {
      await mutex.connect(locker).lock(borrower.address, owner.address)
    })

    it('reverts if other caller tries to unlock', async () => {
      await expect(mutex.connect(borrower).unlock(borrower.address))
        .to.be.revertedWith('BorrowingMutex: Only locker can unlock')

      await expect(mutex.connect(locker).unlock(borrower.address))
        .to.be.revertedWith('BorrowingMutex: Only locker can unlock')

      await expect(mutex.connect(owner).unlock(borrower.address))
        .not.to.be.reverted
    })

    it('locker unlocks', async () => {
      expect(await mutex.locker(borrower.address)).to.eq(owner.address)
      await mutex.connect(owner).unlock(borrower.address)
      expect(await mutex.locker(borrower.address)).to.eq(AddressZero)
    })

    it('emits event', async () => {
      await expect(mutex.connect(owner).unlock(borrower.address))
        .to.emit(mutex, 'BorrowerUnlocked')
        .withArgs(borrower.address, owner.address)
    })
  })
})