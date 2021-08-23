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
  let registry: BorrowingMutex

  beforeEachWithFixture(async (wallets) => {
    [owner, locker, borrower] = wallets
    const deployContract = setupDeploy(owner)
    registry = await deployContract(BorrowingMutex__factory)
    await registry.initialize()
    await registry.allowLocker(locker.address, true)
  })

  describe('initializer', () => {
    it('sets owner', async () => {
      expect(await registry.owner()).to.eq(owner.address)
    })
  })

  describe('allowLocker', () => {
    it('only owner can call', async () => {
      await expect(registry.connect(locker).allowLocker(locker.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')

      await expect(registry.connect(owner).allowLocker(locker.address, true))
        .not.to.be.reverted
    })

    it('changes allowance status', async () => {
      expect(await registry.canLock(owner.address)).to.eq(false)

      await registry.allowLocker(owner.address, true)
      expect(await registry.canLock(owner.address)).to.eq(true)

      await registry.allowLocker(owner.address, false)
      expect(await registry.canLock(owner.address)).to.eq(false)
    })
  })

  describe('lock', () => {
    it('sender not in canLock', async () => {
      await expect(registry.connect(owner).lock(borrower.address, owner.address))
        .to.be.revertedWith('BorrowingMutex: Sender is not allowed to lock borrowers')

      await expect(registry.connect(locker).lock(borrower.address, owner.address))
        .not.to.be.reverted
    })

    it('changes locker', async () => {
      await registry.connect(locker).lock(borrower.address, owner.address)
      expect(await registry.locker(borrower.address)).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(registry.connect(locker).lock(borrower.address, owner.address))
        .to.emit(registry, 'BorrowerLocked')
        .withArgs(borrower.address, owner.address)
    })
  })

  describe('unlock', () => {
    beforeEach(async () => {
      await registry.connect(locker).lock(borrower.address, owner.address)
    })

    it('reverts if other caller tries to unlock', async () => {
      await expect(registry.connect(borrower).unlock(borrower.address))
        .to.be.revertedWith('BorrowingMutex: Only locker can unlock')

      await expect(registry.connect(locker).unlock(borrower.address))
        .to.be.revertedWith('BorrowingMutex: Only locker can unlock')

      await expect(registry.connect(owner).unlock(borrower.address))
        .not.to.be.reverted
    })

    it('locker unlocks', async () => {
      expect(await registry.locker(borrower.address)).to.eq(owner.address)
      await registry.connect(owner).unlock(borrower.address)
      expect(await registry.locker(borrower.address)).to.eq(AddressZero)
    })

    it('emits event', async () => {
      await expect(registry.connect(owner).unlock(borrower.address))
        .to.emit(registry, 'BorrowerUnlocked')
        .withArgs(borrower.address, owner.address)
    })
  })
})
