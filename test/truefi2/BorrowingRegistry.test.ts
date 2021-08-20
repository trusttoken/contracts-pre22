import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils'
import {
  BorrowingRegistry,
  BorrowingRegistry__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('BorrowingRegistry', () => {
  let owner: Wallet
  let locker: Wallet
  let borrower: Wallet
  let registry: BorrowingRegistry

  beforeEachWithFixture(async (wallets) => {
    [owner, locker, borrower] = wallets
    const deployContract = setupDeploy(owner)
    registry = await deployContract(BorrowingRegistry__factory)
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
    describe('reverts if', () => {
      it('sender not in canLock', async () => {
        await expect(registry.connect(owner).lock(borrower.address))
          .to.be.revertedWith('BorrowingRegistry: Sender is not allowed to lock borrowers')

        await expect(registry.connect(locker).lock(borrower.address))
          .not.to.be.reverted
      })

      it('borrower is already locked', async () => {
        await registry.connect(locker).lock(borrower.address)
        await expect(registry.connect(locker).lock(borrower.address))
          .to.be.revertedWith('BorrowingRegistry: Borrower is already locked')
      })
    })

    it('changes locker', async () => {
      await registry.connect(locker).lock(borrower.address)
      expect(await registry.locker(borrower.address)).to.eq(locker.address)
    })

    it('emits event', async () => {
      await expect(registry.connect(locker).lock(borrower.address))
        .to.emit(registry, 'BorrowerLocked')
        .withArgs(borrower.address, locker.address)
    })
  })

  describe('unlock', () => {
    beforeEach(async () => {
      await registry.connect(locker).lock(borrower.address)
    })

    it('reverts if other caller tries to unlock', async () => {
      await expect(registry.connect(owner).unlock(borrower.address))
        .to.be.revertedWith('BorrowingRegistry: Only address that locked borrower can unlock')
    })

    it('changes locker', async () => {
      expect(await registry.locker(borrower.address)).to.eq(locker.address)
      await registry.connect(locker).unlock(borrower.address)
      expect(await registry.locker(borrower.address)).to.eq(AddressZero)
    })

    it('emits event', async () => {
      await expect(registry.connect(locker).unlock(borrower.address))
        .to.emit(registry, 'BorrowerUnlocked')
        .withArgs(borrower.address, locker.address)
    })
  })
})
